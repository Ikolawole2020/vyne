"""Move P2P ads off NGN onto USD.

New ads already default to USD; this rewrites rows created before that change.
Existing amounts are denominated in NGN, so they are divided by the seeded
exchange rate to land on realistic USD figures rather than leaving e.g. a
"1,640 USD" price on the board.
"""
from decimal import Decimal

from django.db import migrations, models

NGN_PER_USD = Decimal("1640")
SCALE_FIELDS = ("price", "available", "min_limit", "max_limit")


def _scale(apps, schema_editor, factor, from_fiat, to_fiat):
    P2PAd = apps.get_model("products", "P2PAd")
    for ad in P2PAd.objects.filter(fiat=from_fiat).iterator():
        for field in SCALE_FIELDS:
            setattr(ad, field, getattr(ad, field) * factor)
        ad.fiat = to_fiat
        ad.save(update_fields=list(SCALE_FIELDS) + ["fiat"])


def to_usd(apps, schema_editor):
    _scale(apps, schema_editor, Decimal("1") / NGN_PER_USD, "NGN", "USD")


def to_ngn(apps, schema_editor):
    _scale(apps, schema_editor, NGN_PER_USD, "USD", "NGN")


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0003_earnposition_last_accrued_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="p2pad",
            name="fiat",
            field=models.CharField(default="USD", max_length=8),
        ),
        migrations.RunPython(to_usd, to_ngn),
    ]
