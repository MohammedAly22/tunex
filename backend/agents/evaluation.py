"""Evaluation Agent: Post-training benchmarking and analysis.

Uses the LLM to analyze training results and provide deployment recommendations.
In production, this would run actual benchmarks; currently it simulates scores
and uses the LLM for analysis.
"""

import random
import logging
from .base import BaseAgent, AgentState
from .schemas import EvaluationOutput, BenchmarkResult

logger = logging.getLogger("tunex.agents")

SYSTEM_PROMPT = """You are the Evaluation Agent for TuneX, an LLM fine-tuning platform.

After training completes, you evaluate the fine-tuned model and provide a deployment recommendation.

You will receive benchmark results comparing the base model vs fine-tuned model.
Analyze the results and provide:
1. Overall assessment of the fine-tuning quality
2. Whether there are regressions on general benchmarks (catastrophic forgetting)
3. A clear deployment recommendation

Scoring guidelines:
- Task-specific improvement > 5%: Strong success
- Task-specific improvement 1-5%: Moderate success
- General benchmark regression > 3%: Concerning (possible catastrophic forgetting)
- General benchmark regression > 10%: Recommend reverting

Set ready_for_deployment=true only if:
- Task-specific benchmarks improved
- No significant regressions on general benchmarks
- The model shows consistent improvements across related benchmarks
"""


class EvaluationAgent(BaseAgent):
    name = "evaluation"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Selecting evaluation benchmarks...", msg_type="thought")

        benchmarks = self._get_benchmarks_for_task(state)
        await self.emit(f"Running {len(benchmarks)} benchmarks: {', '.join(benchmarks)}")

        await self.set_status("acting")

        # Simulate benchmark scores (in production, would run actual evals)
        results = []
        for bench_name in benchmarks:
            base_score, finetuned_score = self._simulate_benchmark(bench_name, state)
            delta = round(finetuned_score - base_score, 1)
            results.append(BenchmarkResult(
                name=bench_name,
                base_score=base_score,
                finetuned_score=finetuned_score,
                delta=delta,
            ))

            if self.broadcast_fn:
                await self.broadcast_fn({
                    "type": "benchmark_result",
                    "benchmark": bench_name,
                    "base_score": base_score,
                    "finetuned_score": finetuned_score,
                })

            sign = "+" if delta > 0 else ""
            severity = "success" if delta > 0 else "warning" if delta == 0 else "error"
            await self.emit(
                f"{bench_name}: {base_score:.1f} → {finetuned_score:.1f} ({sign}{delta:.1f}%)",
                severity=severity,
            )

        # Ask LLM for structured evaluation
        results_str = "\n".join(
            f"- {r.name}: base={r.base_score}, finetuned={r.finetuned_score}, delta={r.delta}"
            for r in results
        )
        eval_input = (
            f"Model: {state.model_id}\n"
            f"Task: {state.task_type}\n"
            f"Method: {state.best_method}\n\n"
            f"Benchmark results:\n{results_str}"
        )

        output = await self.call_llm_structured(
            user_message=eval_input,
            output_schema=EvaluationOutput,
        )

        # Override with actual computed values
        output.benchmarks = results
        output.avg_improvement = round(
            sum(r.delta for r in results) / len(results), 1
        ) if results else 0
        output.regressions = sum(1 for r in results if r.delta < 0)

        await self.emit(output.summary, severity="info", msg_type="result")
        await self.emit(
            f"Average improvement: +{output.avg_improvement:.1f}% | "
            f"Regressions: {output.regressions}/{len(results)} | "
            f"Deployment ready: {'Yes' if output.ready_for_deployment else 'No'}",
            severity="success" if output.ready_for_deployment else "warning",
        )

        await self.set_status("complete")
        return state

    def _get_benchmarks_for_task(self, state: AgentState) -> list[str]:
        task = (state.task_type or "").lower()
        prompt = state.user_prompt.lower()
        combined = f"{task} {prompt}"

        if any(k in combined for k in ["code", "programming", "python"]):
            return ["HumanEval", "MBPP", "MMLU", "ARC", "HellaSwag"]
        elif any(k in combined for k in ["chat", "conversation", "assistant"]):
            return ["MT-Bench", "AlpacaEval", "MMLU", "ARC", "HellaSwag"]
        elif any(k in combined for k in ["math", "reason", "logic"]):
            return ["GSM8K", "MATH", "MMLU", "ARC", "HellaSwag"]
        elif any(k in combined for k in ["classif", "sentiment"]):
            return ["GLUE", "SuperGLUE", "MMLU", "ARC"]
        else:
            return ["MMLU", "ARC", "HellaSwag", "TruthfulQA", "WinoGrande"]

    def _simulate_benchmark(self, bench_name: str, state: AgentState) -> tuple[float, float]:
        """Simulate benchmark scores (in production, would run actual evals)."""
        random.seed(hash(bench_name + state.model_id))

        base_scores = {
            "HumanEval": 42.1, "MBPP": 38.7, "MMLU": 61.2, "ARC": 54.3,
            "HellaSwag": 72.1, "MT-Bench": 6.8, "AlpacaEval": 65.3,
            "GSM8K": 45.2, "MATH": 18.4, "TruthfulQA": 48.7, "WinoGrande": 71.2,
            "GLUE": 82.5, "SuperGLUE": 76.3,
        }
        base = base_scores.get(bench_name, 50 + random.uniform(-10, 10))

        task = (state.task_type or "").lower()
        task_relevant = (
            ("code" in task and bench_name in ("HumanEval", "MBPP"))
            or ("chat" in task and bench_name in ("MT-Bench", "AlpacaEval"))
            or ("math" in task and bench_name in ("GSM8K", "MATH"))
        )

        improvement = random.uniform(5, 25) if task_relevant else random.uniform(0.5, 3)
        finetuned = min(base + improvement, 100)
        return round(base, 1), round(finetuned, 1)
