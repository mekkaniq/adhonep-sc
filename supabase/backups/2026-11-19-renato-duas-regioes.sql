-- Backup antes de dar ao Renato Moreira a 2ª região (Tijucas, id 5). 19/11/2026.
-- Antes: 1 papel em user_roles — id 14, regional_director, região 18 (Florianópolis), user dc62617c-3785-4f44-b2c5-866d864a9e80.
-- regions.director_name já era "Renato Moreira" em Florianópolis (18) e Tijucas (5): não mudou.
-- CAMINHO DE VOLTA (tira só a 2ª região, o papel de Florianópolis continua):
-- delete from user_roles where user_id='dc62617c-3785-4f44-b2c5-866d864a9e80' and role='regional_director' and region_id=5;
-- APLICADO em 19/11/2026: user_roles id 15 (regional_director, região 5) criado. Conferido: Renato vê os 8 capítulos da região 18.

-- 2ª parte (pedido do Eduardo, 19/11/2026): capítulo Tijucas (id 61) estava na região 18 (Florianópolis); a cidade é da região 5 (Tijucas).
-- Histórico: o Eduardo trocou a região do capítulo às 15h30 e 15h52 (teste e devolução); ficou em 18.
-- CAMINHO DE VOLTA: update chapters set region_id=18 where id=61;
-- APLICADO em 19/11/2026: capítulo 61 na região 5. Conferido como Renato: Florianópolis 7 e Tijucas 1, acesso a todos; nenhum capítulo de SC fora da região da sua cidade.

-- 20/11/2026 (pedido do Eduardo): Luciano Marengo (f4b4c084-5678-4a5f-9e6c-73077d187cda) também diretor de Canoinhas (região 20);
-- regions.director_name de Canoinhas era "Diretor Não Informado" → "Luciano Marengo".
-- CAMINHO DE VOLTA: delete from user_roles where user_id='f4b4c084-5678-4a5f-9e6c-73077d187cda' and role='regional_director' and region_id=20;
--                   update regions set director_name='Diretor Não Informado' where id=20;
