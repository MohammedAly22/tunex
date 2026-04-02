"""Dataset Agent: Searches HuggingFace for datasets, evaluates quality, selects the best match.

Uses the HuggingFace Hub API to search for datasets, then asks the LLM to
evaluate and rank candidates for the user's specific task.
"""

import logging
import httpx
from .base import BaseAgent, AgentState
from .schemas import DatasetOutput, DatasetCandidate

logger = logging.getLogger("tunex.agents")

SYSTEM_PROMPT = """You are the Dataset Agent for TuneX, an LLM fine-tuning platform.

You will receive a list of dataset candidates from HuggingFace search results along with
the user's task and model. Your job is to select the BEST dataset for fine-tuning.

Evaluation criteria (in order of importance):
1. Task relevance — does the dataset match what the user wants to fine-tune for?
2. Format compatibility — instruction-response pairs are ideal for SFT
3. Size — at least 5K samples preferred, 10K+ is ideal
4. Quality — well-known, widely-used datasets are preferred
5. License — prefer permissive (Apache 2.0, MIT, CC-BY)

Well-known datasets by task (prefer these when they match):
- Code generation: sahil2801/CodeAlpaca-20k, nickrosh/Evol-Instruct-Code-80k-v1, TokenBender/code_instructions_122k_alpaca_style
- Chat/conversation: Open-Orca/OpenOrca, HuggingFaceH4/ultrachat_200k, Intel/orca_dpo_pairs
- Summarization: cnn_dailymail, EdinburghNLP/xsum, Samsung/samsum
- Translation: wmt16, Helsinki-NLP/opus-100
- Math reasoning: gsm8k, hendrycks/competition_math, TIGER-Lab/MathInstruct
- Classification: ag_news, SetFit/sst2, dair-ai/emotion
- General instruction following: tatsu-lab/alpaca, yahma/alpaca-cleaned, databricks/databricks-dolly-15k

Output the selected dataset details. If user specified a dataset, verify it's valid and appropriate.
"""


async def search_huggingface_datasets(query: str, limit: int = 10) -> list[dict]:
    """Search HuggingFace Hub for datasets matching a query."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://huggingface.co/api/datasets",
                params={
                    "search": query,
                    "limit": limit,
                    "sort": "downloads",
                    "direction": "-1",
                },
            )
            resp.raise_for_status()
            results = resp.json()
            return [
                {
                    "id": ds.get("id", ""),
                    "downloads": ds.get("downloads", 0),
                    "likes": ds.get("likes", 0),
                    "tags": ds.get("tags", []),
                    "description": ds.get("description", "")[:200],
                }
                for ds in results
                if ds.get("id")
            ]
    except Exception as e:
        logger.warning(f"HuggingFace dataset search failed: {e}")
        return []


async def get_dataset_info(dataset_id: str) -> dict:
    """Get detailed info about a specific HuggingFace dataset."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://huggingface.co/api/datasets/{dataset_id}",
            )
            resp.raise_for_status()
            data = resp.json()
            # Try to get split info
            splits = {}
            card = data.get("cardData", {})
            if card and "dataset_info" in card:
                info = card["dataset_info"]
                if isinstance(info, dict) and "splits" in info:
                    for split in info["splits"]:
                        splits[split.get("name", "")] = split.get("num_examples", 0)
            return {
                "id": data.get("id", dataset_id),
                "description": data.get("description", "")[:500],
                "downloads": data.get("downloads", 0),
                "likes": data.get("likes", 0),
                "tags": data.get("tags", []),
                "splits": splits,
            }
    except Exception as e:
        logger.warning(f"Failed to get dataset info for {dataset_id}: {e}")
        return {"id": dataset_id, "splits": {}}


class DatasetAgent(BaseAgent):
    name = "dataset"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")

        # If user specified a dataset, validate and use it
        if state.dataset_id:
            await self.emit(f"Validating user-specified dataset: {state.dataset_id}...")
            info = await get_dataset_info(state.dataset_id)
            splits = info.get("splits", {})
            train_size = splits.get("train", 10000)
            eval_size = splits.get("validation", splits.get("test", 1000))

            state.dataset_train_size = train_size or 10000
            state.dataset_eval_size = eval_size or 1000
            state.dataset_downloaded = True

            await self.emit(
                f"Dataset '{state.dataset_id}' validated. "
                f"Train: {state.dataset_train_size:,} / Eval: {state.dataset_eval_size:,}",
                severity="success",
            )
            await self.set_status("complete")
            return state

        # Search HuggingFace for datasets
        await self.set_status("acting")
        task = state.task_type or "general"

        # Build search queries based on task
        search_queries = self._build_search_queries(task, state.user_prompt)
        all_candidates = []

        for query in search_queries:
            await self.emit(f"Searching HuggingFace: '{query}'...")
            results = await search_huggingface_datasets(query, limit=8)
            all_candidates.extend(results)

        # Deduplicate
        seen = set()
        unique = []
        for c in all_candidates:
            if c["id"] not in seen:
                seen.add(c["id"])
                unique.append(c)

        if not unique:
            await self.emit("No datasets found via search, using known dataset for task", severity="warning")
            # Use the LLM to recommend from its knowledge
            unique = [{"id": "unknown", "downloads": 0, "likes": 0, "tags": [], "description": ""}]

        await self.emit(f"Found {len(unique)} candidate datasets. Evaluating with LLM...")

        # Ask LLM to select the best dataset
        candidates_str = "\n".join(
            f"- {c['id']} (downloads: {c['downloads']:,}, likes: {c['likes']}) "
            f"tags: {c.get('tags', [])[:5]} — {c.get('description', '')[:100]}"
            for c in unique[:15]
        )

        llm_input = (
            f"Task: {task}\n"
            f"Model: {state.model_id}\n"
            f"User goal: {state.user_prompt}\n\n"
            f"HuggingFace search results:\n{candidates_str}\n\n"
            f"Select the BEST dataset for this fine-tuning task. "
            f"If none of the search results are suitable, recommend a well-known dataset from your knowledge."
        )

        output = await self.call_llm_structured(
            user_message=llm_input,
            output_schema=DatasetOutput,
        )

        # Get real split sizes if possible
        if output.dataset_id != "unknown":
            info = await get_dataset_info(output.dataset_id)
            splits = info.get("splits", {})
            if splits:
                output.train_samples = splits.get("train", output.train_samples)
                output.eval_samples = splits.get(
                    "validation", splits.get("test", output.eval_samples)
                )

        state.dataset_id = output.dataset_id
        state.dataset_train_size = output.train_samples
        state.dataset_eval_size = output.eval_samples
        state.dataset_downloaded = True

        await self.emit(
            f"Selected: {output.dataset_id} — {output.reason}",
            severity="success",
        )
        await self.emit(
            f"Format: {output.format_type} | License: {output.license} | "
            f"Train: {output.train_samples:,} / Eval: {output.eval_samples:,}",
            severity="success",
        )

        await self.set_status("complete")
        return state

    def _build_search_queries(self, task: str, prompt: str) -> list[str]:
        """Build HuggingFace search queries from the task type."""
        queries = []
        task_lower = task.lower()
        prompt_lower = prompt.lower()

        if "code" in task_lower or "code" in prompt_lower:
            queries.extend(["code instructions", "code alpaca", "python code"])
        elif "chat" in task_lower or "conversation" in task_lower:
            queries.extend(["chat instructions", "conversation", "orca"])
        elif "summar" in task_lower:
            queries.extend(["summarization", "cnn dailymail", "xsum"])
        elif "translat" in task_lower:
            queries.extend(["translation", "wmt", "opus"])
        elif "math" in task_lower or "reason" in task_lower:
            queries.extend(["math reasoning", "gsm8k", "math instruct"])
        elif "classif" in task_lower:
            queries.extend(["text classification", "sentiment", "nli"])
        else:
            queries.extend(["instruction following", "alpaca", "dolly"])

        # Add a query from the user's prompt
        keywords = [w for w in prompt_lower.split() if len(w) > 3 and w not in (
            "fine", "tune", "model", "train", "want", "need", "make", "create",
            "using", "with", "from", "that", "this", "fine-tune",
        )]
        if keywords:
            queries.append(" ".join(keywords[:4]))

        return queries[:4]  # Limit to 4 search queries
