-- Update existing product images to use local files from public folder
-- This migration updates the placeholder images to use actual product images

UPDATE products 
SET images = ARRAY['/ChrisCrossBlackCottonT-Shirt.webp']
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE products 
SET images = ARRAY['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg']
WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE products 
SET images = ARRAY['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg']
WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE products 
SET images = ARRAY['/b43457a0-76b6-11f0-9faf-5258f188704a.png']
WHERE id = '00000000-0000-0000-0000-000000000004';

UPDATE products 
SET images = ARRAY['/moleskine-classic-hardcover-notebook-black.webp']
WHERE id = '00000000-0000-0000-0000-000000000005';
