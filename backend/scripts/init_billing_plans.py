#!/usr/bin/env python3
"""
Initialize billing plans from templates

Usage:
    python -m backend.scripts.init_billing_plans [--include-annual] [--include-promo]

Options:
    --include-annual    Also create annual plans
    --include-promo     Also create promotional plans
    --force             Overwrite existing plans
"""

import sys
import argparse
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from open_webui.models.billing import Plans
from open_webui.utils.plan_templates import (
    get_default_plans,
    get_annual_plans,
    get_promo_plans,
)


def init_plans(include_annual=False, include_promo=False, force=False):
    """Initialize billing plans from templates"""

    plans_to_create = []

    # Always include default plans
    plans_to_create.extend(get_default_plans())

    # Optionally include annual plans
    if include_annual:
        plans_to_create.extend(get_annual_plans())

    # Optionally include promo plans
    if include_promo:
        plans_to_create.extend(get_promo_plans())

    created_count = 0
    skipped_count = 0
    updated_count = 0

    for plan_data in plans_to_create:
        plan_id = plan_data["id"]
        existing_plan = Plans.get_plan_by_id(plan_id)

        if existing_plan:
            if force:
                # Update existing plan
                Plans.update_plan_by_id(plan_id, plan_data)
                print(f"✓ Updated plan: {plan_data['name']} (id={plan_id})")
                updated_count += 1
            else:
                print(f"⊘ Skipped existing plan: {plan_data['name']} (id={plan_id})")
                skipped_count += 1
        else:
            # Create new plan
            Plans.create_plan(plan_data)
            print(f"✓ Created plan: {plan_data['name']} (id={plan_id})")
            created_count += 1

    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Created: {created_count}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total:   {len(plans_to_create)}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Initialize billing plans")
    parser.add_argument(
        "--include-annual",
        action="store_true",
        help="Include annual plans (20%% discount)",
    )
    parser.add_argument(
        "--include-promo", action="store_true", help="Include promotional plans"
    )
    parser.add_argument(
        "--force", action="store_true", help="Overwrite existing plans"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Initializing Billing Plans")
    print("=" * 60)
    print(f"Include annual plans: {args.include_annual}")
    print(f"Include promo plans:  {args.include_promo}")
    print(f"Force update:         {args.force}")
    print("=" * 60)
    print()

    try:
        init_plans(
            include_annual=args.include_annual,
            include_promo=args.include_promo,
            force=args.force,
        )
        print("\n✓ Plans initialized successfully!")
        return 0
    except Exception as e:
        print(f"\n✗ Error initializing plans: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
