-- Swap precio_mayorista and precio_minorista values
-- The client loaded them reversed: what's labeled "mayorista" (wholesale)
-- is actually the retail price, and vice versa.
-- PostgreSQL evaluates all SET expressions from the OLD row values
-- simultaneously, so this swap is safe and atomic.
UPDATE productos SET precio_mayorista = precio_minorista, precio_minorista = precio_mayorista;
