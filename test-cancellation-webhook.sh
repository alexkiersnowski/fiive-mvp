#!/bin/bash

# Test script to help test subscription cancellation webhook
# NOTE: Stripe CLI trigger doesn't easily set cancel_at_period_end=true
# Better to cancel a real subscription via Stripe Dashboard

echo "⚠️  IMPORTANT: Stripe CLI 'trigger' command doesn't let you set cancel_at_period_end=true"
echo ""
echo "Better approach:"
echo "1. Make sure dev server is on port 3000"
echo "2. Run: stripe listen --forward-to localhost:3000/api/stripe/webhook"
echo "3. Cancel a subscription via Stripe Dashboard (Cancel at period end)"
echo "4. Watch the webhook come through"
echo ""
echo "Alternatively, use Stripe API to update a subscription:"
echo ""
echo "  stripe subscriptions update sub_XXXXX --cancel-at-period-end"
echo ""
read -p "Do you want to try triggering a basic subscription.updated event? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "Triggering customer.subscription.updated..."
    stripe trigger customer.subscription.updated
    echo ""
    echo "⚠️  Note: This test event may not have cancel_at_period_end=true"
    echo "Check your logs to see what values are in the subscription object"
fi

