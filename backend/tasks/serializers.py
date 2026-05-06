from rest_framework import serializers
from .models import Task


class TaskRawSerializer(serializers.ModelSerializer):
    deps = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ["code", "name", "category", "subcategory", "coverage", "uom", "days", "deps", "sort_order"]

    def get_deps(self, obj):
        return list(obj.deps.values_list("code", flat=True))
