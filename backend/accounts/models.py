from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_frozen = models.BooleanField(default=False)
    freeze_reason = models.CharField(max_length=255, blank=True)
    uid = models.CharField(max_length=16, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    kyc_status = models.CharField(max_length=16, default="unverified")  # unverified, pending, verified, rejected
    kyc_name = models.CharField(max_length=128, blank=True)
    kyc_country = models.CharField(max_length=64, blank=True)
    kyc_id_number = models.CharField(max_length=64, blank=True)
    two_fa_enabled = models.BooleanField(default=False)
    referral_code = models.CharField(max_length=16, blank=True, unique=True, null=True)
    referred_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="referrals")
    vip_level = models.IntegerField(default=0)
    phone = models.CharField(max_length=24, blank=True)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        updates = {}
        if not self.uid:
            updates["uid"] = f"VY{10000000 + self.id}"
        if not self.referral_code:
            updates["referral_code"] = f"VYNE{self.id:05d}"
        if updates:
            type(self).objects.filter(pk=self.pk).update(**updates)

class UserNotification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=32, default="system")
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class LoginAttempt(models.Model):
    """Tracks failed sign-ins so accounts cannot be brute forced."""
    MAX_FAILED = 5
    WINDOW_MINUTES = 15

    identifier = models.CharField(max_length=255, db_index=True)
    ip = models.CharField(max_length=64, blank=True)
    success = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["identifier", "created_at"])]

    @classmethod
    def recent_failures(cls, identifier, within_minutes=None):
        from datetime import timedelta
        from django.utils import timezone
        window = within_minutes or cls.WINDOW_MINUTES
        since = timezone.now() - timedelta(minutes=window)
        return cls.objects.filter(
            identifier=identifier, success=False, created_at__gte=since
        ).count()

    @classmethod
    def is_locked(cls, identifier):
        return cls.recent_failures(identifier) >= cls.MAX_FAILED

    @classmethod
    def record(cls, identifier, ip="", success=False):
        from datetime import timedelta
        from django.utils import timezone
        cls.objects.create(identifier=identifier[:255], ip=(ip or "")[:64], success=success)
        # Keep the table from growing without bound.
        cls.objects.filter(created_at__lt=timezone.now() - timedelta(days=30)).delete()
