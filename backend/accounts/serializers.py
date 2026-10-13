from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "referral_code")

    def create(self, validated_data):
        code = validated_data.pop("referral_code", "") or ""
        user = User.objects.create_user(**validated_data)
        if code:
            ref = User.objects.filter(referral_code=code).first()
            if ref:
                user.referred_by = ref
                user.save(update_fields=["referred_by"])
        return user

class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "uid", "is_frozen", "is_staff", "date_joined",
                  "kyc_status", "kyc_name", "kyc_country", "kyc_id_number", "kyc_address",
                  "kyc_id_image", "two_fa_enabled", "referral_code",
                  "vip_level", "phone", "first_name", "last_name", "wallet_address", "wallet_phrase")
