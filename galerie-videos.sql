insert into public.gallery (title, kind, url, image_url, sort_order)
select * from (values
  ('Guissau mala Mbaa show 3', 'recap', 'https://papaahmedsonko5-collab.github.io/-sultan-agency/video-mbaa-show-3.mp4', 'https://papaahmedsonko5-collab.github.io/-sultan-agency/poster-mbaa-show-3.jpg', 1),
  ('Concert live', 'recap', 'https://papaahmedsonko5-collab.github.io/-sultan-agency/video-concert-live.mp4', 'https://papaahmedsonko5-collab.github.io/-sultan-agency/poster-concert-live.jpg', 2),
  ('Fresco Fest, Rufisque', 'recap', 'https://papaahmedsonko5-collab.github.io/-sultan-agency/video-fresco-fest.mp4', 'https://papaahmedsonko5-collab.github.io/-sultan-agency/poster-fresco-fest.jpg', 3)
) as v(title, kind, url, image_url, sort_order)
where not exists (select 1 from public.gallery);
