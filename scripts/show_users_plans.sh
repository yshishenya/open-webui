#!/bin/bash
# Show all users with their subscription plans

docker compose exec postgres psql -U airis -d airis -c "
SELECT
    u.name as \"Имя\",
    u.email as \"Email\",
    u.role as \"Роль\",
    COALESCE(p.name, 'Без плана') as \"План\",
    COALESCE(p.price::text || ' ₽', '-') as \"Цена\",
    COALESCE(s.status, '-') as \"Статус\",
    COALESCE(to_char(to_timestamp(s.created_at), 'DD.MM.YYYY HH24:MI'), '-') as \"Подписка с\"
FROM \"user\" u
LEFT JOIN billing_subscription s ON u.id = s.user_id
LEFT JOIN billing_plan p ON s.plan_id = p.id
ORDER BY u.created_at DESC;
"
