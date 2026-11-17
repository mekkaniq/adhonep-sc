-- v3.22 · relatório de evento com até 3 fotos
select teste.confere('fotos: coluna photo_paths existe e começa vazia',
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='chapter_reports' and column_name='photo_paths'));

select teste.confere('fotos: presidente grava relatório com 3 fotos do capítulo dele',
  teste.linhas(teste.tenta(teste.uid('presidente'), $q$insert into public.chapter_reports (chapter_id, event_name, responsible_name, summary, photo_paths)
    values (801, 'TESTE evento', 'Fulano', 'Resumo', array['801/a.jpg','801/b.png','801/c.webp'])$q$)) = 1);

select teste.confere('fotos: 4 fotos é recusado',
  teste.tenta(teste.uid('presidente'), $q$insert into public.chapter_reports (chapter_id, event_name, responsible_name, summary, photo_paths)
    values (801, 'TESTE evento', 'Fulano', 'Resumo', array['801/a.jpg','801/b.jpg','801/c.jpg','801/d.jpg'])$q$) like 'erro:%');

select teste.confere('fotos: foto de outro capítulo no caminho é recusada',
  teste.tenta(teste.uid('presidente'), $q$insert into public.chapter_reports (chapter_id, event_name, responsible_name, summary, photo_paths)
    values (801, 'TESTE evento', 'Fulano', 'Resumo', array['802/a.jpg'])$q$) like 'erro:%');

select teste.confere('fotos: caminho com ../ é recusado',
  teste.tenta(teste.uid('admin'), $q$insert into public.chapter_reports (chapter_id, event_name, responsible_name, summary, photo_paths)
    values (801, 'TESTE evento', 'Fulano', 'Resumo', array['801/../x.jpg'])$q$) like 'erro:%');

select teste.confere('fotos: relatório sem fotos continua funcionando',
  teste.linhas(teste.tenta(teste.uid('presidente'), $q$insert into public.chapter_reports (chapter_id, event_name, responsible_name, summary)
    values (801, 'TESTE evento', 'Fulano', 'Resumo')$q$)) = 1);

select teste.confere('fotos: sócio continua sem poder criar relatório',
  teste.bloqueou(teste.tenta(teste.uid('socio'), $q$insert into public.chapter_reports (chapter_id, event_name, responsible_name, summary, photo_paths)
    values (801, 'TESTE evento', 'Fulano', 'Resumo', array['801/a.jpg'])$q$)));
