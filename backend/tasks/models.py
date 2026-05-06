from django.db import models


class Task(models.Model):
    code = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    subcategory = models.CharField(max_length=100, blank=True)
    coverage = models.CharField(max_length=20, blank=True)
    uom = models.CharField(max_length=20, blank=True)
    days = models.PositiveIntegerField()
    deps = models.ManyToManyField("self", symmetrical=False, related_name="successors", blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self):
        return f"{self.code} — {self.name}"
