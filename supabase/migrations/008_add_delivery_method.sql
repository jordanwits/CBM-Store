-- Add delivery_method column to orders table (nullable initially for existing orders)
ALTER TABLE orders 
ADD COLUMN delivery_method TEXT CHECK (delivery_method IN ('pickup', 'delivery'));

-- Set default value for existing orders (assume they were delivery)
UPDATE orders SET delivery_method = 'delivery' WHERE delivery_method IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE orders 
ALTER COLUMN delivery_method SET NOT NULL,
ALTER COLUMN delivery_method SET DEFAULT 'delivery';

-- Make shipping fields nullable since pickup orders don't need them
ALTER TABLE orders 
ALTER COLUMN ship_name DROP NOT NULL,
ALTER COLUMN ship_address_line1 DROP NOT NULL,
ALTER COLUMN ship_city DROP NOT NULL,
ALTER COLUMN ship_state DROP NOT NULL,
ALTER COLUMN ship_zip DROP NOT NULL,
ALTER COLUMN ship_country DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN orders.delivery_method IS 'Order delivery method: pickup or delivery. Shipping fields are only required for delivery orders.';
