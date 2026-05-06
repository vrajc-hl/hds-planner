from django.urls import path
from . import views

urlpatterns = [
    path("plan/", views.PlanView.as_view(), name="plan"),
    path("plan/reorder/", views.ReorderView.as_view(), name="plan-reorder"),
    path("plan/recompute/", views.RecomputeView.as_view(), name="plan-recompute"),
    path("tasks/", views.TaskListView.as_view(), name="task-list"),
    path("tasks/<str:code>/", views.TaskDetailView.as_view(), name="task-detail"),
]
