from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Task
from .serializers import TaskRawSerializer
from .cpm import compute_schedule


def _build_plan_response():
    tasks_qs = Task.objects.prefetch_related("deps").all()
    schedule = compute_schedule(tasks_qs)
    critical_count = sum(1 for t in schedule if t["critical"])
    project_days = max((t["ef"] for t in schedule), default=0)
    return {
        "project_days": project_days,
        "critical_count": critical_count,
        "total_tasks": len(schedule),
        "tasks": schedule,
    }


class PlanView(APIView):
    def get(self, request):
        return Response(_build_plan_response())


class RecomputeView(APIView):
    def post(self, request):
        return Response(_build_plan_response())


class ReorderView(APIView):
    def post(self, request):
        order = request.data.get("order", [])
        if not isinstance(order, list):
            return Response({"error": "order must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for idx, code in enumerate(order):
                Task.objects.filter(code=code).update(sort_order=idx)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskListView(APIView):
    def get(self, request):
        tasks = Task.objects.prefetch_related("deps").all()
        serializer = TaskRawSerializer(tasks, many=True)
        return Response(serializer.data)


class TaskDetailView(APIView):
    def put(self, request, code):
        try:
            task = Task.objects.prefetch_related("deps").get(pk=code)
        except Task.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        new_deps = request.data.get("deps")
        new_sort = request.data.get("sort_order")

        try:
            with transaction.atomic():
                if new_sort is not None:
                    task.sort_order = int(new_sort)
                    task.save(update_fields=["sort_order", "updated_at"])

                if new_deps is not None:
                    dep_codes = list(new_deps)
                    dep_tasks = list(Task.objects.filter(code__in=dep_codes))
                    task.deps.set(dep_tasks)
                    task.refresh_from_db()

                # Validate no cycle after change
                all_tasks = list(Task.objects.prefetch_related("deps").all())
                compute_schedule(all_tasks)

        except ValueError as exc:
            msg = str(exc)
            scc_part = msg.replace("Cycle detected: ", "")
            return Response(
                {"error": "Cycle detected", "scc": scc_part},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task.refresh_from_db()
        serializer = TaskRawSerializer(task)
        return Response(serializer.data)
