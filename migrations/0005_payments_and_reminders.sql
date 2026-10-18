-- Which provider took an online payment, and when a booking was reminded.
ALTER TABLE orders ADD COLUMN payment_provider TEXT CHECK (payment_provider IN ('azul', 'paypal'));
ALTER TABLE reservations ADD COLUMN reminded_at TEXT;
CREATE INDEX orders_awaiting ON orders (status, created_at) WHERE status = 'awaiting_payment';
