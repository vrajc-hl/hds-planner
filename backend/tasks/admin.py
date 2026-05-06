from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "subcategory", "days", "sort_order"]
    list_filter = ["category"]
    search_fields = ["code", "name", "subcategory"]
    filter_horizontal = ["deps"]
    ordering = ["sort_order", "code"]
