-- ============================================================================
-- V9__pines_distintos_usuarios_prueba.sql
-- El ingreso solo con PIN identifica al usuario por su PIN: dos usuarios con el
-- mismo PIN hacen imposible entrar como el segundo. Los usuarios de prueba de V2
-- compartían 1234 (mozo y cocinero). Se asigna un PIN propio a cada rol operativo:
--   angie (MOZO) 1234 · cocinero1 (COCINERO) 5678 · expedidor1 (EXPEDIDOR) 9012
-- Solo se tocan los PIN que siguen con el valor sembrado en V2.
-- ============================================================================

UPDATE usuarios
SET pin_hash = '$2a$10$/ZRUyT3AP0t.2swEW6AoBup2JPkb16QxfKGrEDnmrT3O0mMuWpIjO'
WHERE username = 'cocinero1'
  AND pin_hash = '$2a$10$PTxXLk4t0Ml0uC6NtCAVc.GF5cjChTRatYOGbdlPZEnpuZ8LwKHne';

UPDATE usuarios
SET pin_hash = '$2a$10$gu6JrV6bQHhOy5ICKPgfWeH0FSalSiSDKd.LTh/4PfFci/GNfQ9bS'
WHERE username = 'expedidor1'
  AND pin_hash IS NULL;
