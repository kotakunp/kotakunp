INSERT INTO media (id, kind, original_name, storage_key, public_path, mime_type, byte_size, alt, source, created_at) SELECT 'bundled-cover-white-field', 'image', 'white-field.webp', '/covers/white-field.webp', '/covers/white-field.webp', 'image/webp', 0, 'A white field under an overcast sky', 'bundled', strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM media WHERE id = 'bundled-cover-white-field');
--> statement-breakpoint
INSERT INTO media (id, kind, original_name, storage_key, public_path, mime_type, byte_size, alt, source, created_at) SELECT 'bundled-cover-glass-flowers', 'image', 'glass-flowers.webp', '/covers/glass-flowers.webp', '/covers/glass-flowers.webp', 'image/webp', 0, 'Glass flowers on a windowsill in low light', 'bundled', strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM media WHERE id = 'bundled-cover-glass-flowers');
--> statement-breakpoint
INSERT INTO media (id, kind, original_name, storage_key, public_path, mime_type, byte_size, alt, source, created_at) SELECT 'bundled-cover-rain-city', 'image', 'rain-city.webp', '/covers/rain-city.webp', '/covers/rain-city.webp', 'image/webp', 0, 'Rain falling over a pale transparent city', 'bundled', strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM media WHERE id = 'bundled-cover-rain-city');
--> statement-breakpoint
INSERT INTO media (id, kind, original_name, storage_key, public_path, mime_type, byte_size, alt, source, created_at) SELECT 'bundled-cover-railway-dawn', 'image', 'railway-dawn.webp', '/covers/railway-dawn.webp', '/covers/railway-dawn.webp', 'image/webp', 0, 'A railway platform at dawn', 'bundled', strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM media WHERE id = 'bundled-cover-railway-dawn');
--> statement-breakpoint
INSERT INTO media (id, kind, original_name, storage_key, public_path, mime_type, byte_size, alt, duration_ms, source, created_at) SELECT 'bundled-audio-tcar-preview', 'audio', 'transparent-city-and-rain-preview.wav', '/audio/transparent-city-and-rain-preview.wav', '/audio/transparent-city-and-rain-preview.wav', 'audio/wav', 48044, NULL, 3000, 'bundled', strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM media WHERE id = 'bundled-audio-tcar-preview');
--> statement-breakpoint
INSERT INTO journal_posts (id, slug, title, excerpt, type, body_markdown, status, cover_media_id, published_at, created_at, updated_at) SELECT 'post-building-a-small-listening-room', 'building-a-small-listening-room', 'Building a small listening room', 'Why this website is intentionally quiet, spacious, and a little unfinished.', 'field note', '# Building a small listening room

I wanted this website to feel closer to entering a record sleeve than opening a dashboard.

There are no urgent counters here. A song can sit with an illustration. A note can take a few lines before it says what it means. The generous margins are part of the music.

## A place to return to

The journal is for the pieces that do not fit inside a release description: process notes, unfinished thoughts, translations, and the small discoveries that happen between songs.

It will grow slowly. That is intentional. A quiet archive has its own kind of rhythm.
', 'published', 'bundled-cover-white-field', '1774656000000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'building-a-small-listening-room');
--> statement-breakpoint
INSERT INTO journal_posts (id, slug, title, excerpt, type, body_markdown, status, cover_media_id, published_at, created_at, updated_at) SELECT 'post-notes-before-the-voice', 'notes-before-the-voice', 'Notes before the voice arrives', 'What I listen for before opening a synth, a session, or a blank page.', 'studio note', '# Notes before the voice arrives

Before I choose a singer, I try to understand what the song is already saying without one.

There is usually a shape hidden in the first sketch: a rhythm that wants to keep moving, a chord that refuses to resolve, or a patch that sounds better when it is almost too quiet. I keep those clues around while the arrangement grows.

## A little space

Synthetic voices become expressive when they have somewhere to breathe. I leave gaps between phrases and let the consonants arrive with their own timing. The goal is not to make the voice human. The goal is to make the feeling clear.

The rest is editing: remove what is decorative, keep what is honest, and listen again the next morning.
', 'published', 'bundled-cover-glass-flowers', '1775952000000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'notes-before-the-voice');
--> statement-breakpoint
INSERT INTO journal_posts (id, slug, title, excerpt, type, body_markdown, status, cover_media_id, published_at, created_at, updated_at) SELECT 'post-transparent-city-and-rain', 'transparent-city-and-rain', 'The weather inside a transparent city', 'A few notes about rain, memory, and the first song in the archive.', 'release note', '# The weather inside a transparent city

The first image I had for this song was not a melody. It was a wet street after the last train had gone home.

I wanted the arrangement to feel like walking through a place you recognize but cannot quite name. The drums stay small and close. The vocal sits just above the pavement. Everything else is allowed to blur at the edges.

> Some songs begin as a room. This one began as weather.

## Small sounds

The quiet details carry most of the weight: a muted kick, a breath before the chorus, and a synth line that arrives a little late. Those imperfections make the synthetic voice feel less like a machine and more like a memory trying to return.

The release is still a small beginning, but it gave the rest of the archive somewhere to stand.
', 'published', 'bundled-cover-rain-city', '1777593600000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'transparent-city-and-rain');
--> statement-breakpoint
INSERT INTO tags (id, name, slug) SELECT 'tag-release', 'release', 'release' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE slug = 'release');
--> statement-breakpoint
INSERT INTO tags (id, name, slug) SELECT 'tag-process', 'process', 'process' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE slug = 'process');
--> statement-breakpoint
INSERT INTO tags (id, name, slug) SELECT 'tag-site', 'site', 'site' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE slug = 'site');
--> statement-breakpoint
INSERT INTO journal_post_tags (post_id, tag_id) SELECT 'post-transparent-city-and-rain', 'tag-release' WHERE EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'transparent-city-and-rain') AND NOT EXISTS (SELECT 1 FROM journal_post_tags jpt JOIN journal_posts jp ON jp.id = jpt.post_id WHERE jp.slug = 'transparent-city-and-rain' AND jpt.tag_id = 'tag-release');
--> statement-breakpoint
INSERT INTO journal_post_tags (post_id, tag_id) SELECT 'post-notes-before-the-voice', 'tag-process' WHERE EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'notes-before-the-voice') AND NOT EXISTS (SELECT 1 FROM journal_post_tags jpt JOIN journal_posts jp ON jp.id = jpt.post_id WHERE jp.slug = 'notes-before-the-voice' AND jpt.tag_id = 'tag-process');
--> statement-breakpoint
INSERT INTO journal_post_tags (post_id, tag_id) SELECT 'post-building-a-small-listening-room', 'tag-process' WHERE EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'building-a-small-listening-room') AND NOT EXISTS (SELECT 1 FROM journal_post_tags jpt JOIN journal_posts jp ON jp.id = jpt.post_id WHERE jp.slug = 'building-a-small-listening-room' AND jpt.tag_id = 'tag-process');
--> statement-breakpoint
INSERT INTO journal_post_tags (post_id, tag_id) SELECT 'post-building-a-small-listening-room', 'tag-site' WHERE EXISTS (SELECT 1 FROM journal_posts WHERE slug = 'building-a-small-listening-room') AND NOT EXISTS (SELECT 1 FROM journal_post_tags jpt JOIN journal_posts jp ON jp.id = jpt.post_id WHERE jp.slug = 'building-a-small-listening-room' AND jpt.tag_id = 'tag-site');
--> statement-breakpoint
INSERT INTO music_releases (id, slug, title, english_title, type, description_markdown, status, cover_media_id, release_date, declared_track_count, declared_duration_ms, published_at, created_at, updated_at) SELECT 'release-transparent-city-and-rain', 'transparent-city-and-rain', '透明な街と雨', 'Transparent city and rain', 'single', 'A pale, transparent ballad about rain, memory, and the city that keeps both.', 'published', 'bundled-cover-rain-city', '1777593600000', NULL, NULL, '1777593600000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_releases WHERE slug = 'transparent-city-and-rain');
--> statement-breakpoint
INSERT INTO music_tracks (id, release_id, position, title, english_title, lyrics_markdown, audio_media_id, audio_kind, duration_ms, created_at, updated_at) SELECT 'track-transparent-city-and-rain-01', 'release-transparent-city-and-rain', '1', '透明な街と雨', NULL, NULL, 'bundled-audio-tcar-preview', 'preview', 3000, strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_tracks WHERE id = 'track-transparent-city-and-rain-01');
--> statement-breakpoint
INSERT INTO music_tracks (id, release_id, position, title, english_title, lyrics_markdown, audio_media_id, audio_kind, duration_ms, created_at, updated_at) SELECT 'track-transparent-city-and-rain-02', 'release-transparent-city-and-rain', '2', '傘の忘れ物', NULL, NULL, NULL, 'none', NULL, strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_tracks WHERE id = 'track-transparent-city-and-rain-02');
--> statement-breakpoint
INSERT INTO music_tracks (id, release_id, position, title, english_title, lyrics_markdown, audio_media_id, audio_kind, duration_ms, created_at, updated_at) SELECT 'track-transparent-city-and-rain-03', 'release-transparent-city-and-rain', '3', 'さよならの温度', NULL, NULL, NULL, 'none', NULL, strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_tracks WHERE id = 'track-transparent-city-and-rain-03');
--> statement-breakpoint
INSERT INTO music_tracks (id, release_id, position, title, english_title, lyrics_markdown, audio_media_id, audio_kind, duration_ms, created_at, updated_at) SELECT 'track-transparent-city-and-rain-04', 'release-transparent-city-and-rain', '4', 'アスファルトの記憶', NULL, NULL, NULL, 'none', NULL, strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_tracks WHERE id = 'track-transparent-city-and-rain-04');
--> statement-breakpoint
INSERT INTO music_releases (id, slug, title, english_title, type, description_markdown, status, cover_media_id, release_date, declared_track_count, declared_duration_ms, published_at, created_at, updated_at) SELECT 'release-white-daydream-record', 'white-daydream-record', '白昼夢の記録', 'A record of daydreams', 'ep', 'A record of daydreams — six short pieces caught between waking and sleep.', 'published', 'bundled-cover-white-field', '1771545600000', '6', '1268000', '1771545600000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_releases WHERE slug = 'white-daydream-record');
--> statement-breakpoint
INSERT INTO music_releases (id, slug, title, english_title, type, description_markdown, status, cover_media_id, release_date, declared_track_count, declared_duration_ms, published_at, created_at, updated_at) SELECT 'release-after-the-end-roll', 'after-the-end-roll', 'エンドロールの後で', 'After the end roll', 'single', 'What keeps playing after the end roll: three songs for the quiet after the credits.', 'published', 'bundled-cover-glass-flowers', '1762905600000', '3', '641000', '1762905600000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_releases WHERE slug = 'after-the-end-roll');
--> statement-breakpoint
INSERT INTO music_releases (id, slug, title, english_title, type, description_markdown, status, cover_media_id, release_date, declared_track_count, declared_duration_ms, published_at, created_at, updated_at) SELECT 'release-grey-morning', 'grey-morning', '限りなく灰色に近い朝', 'A nearly grey morning', 'ep', 'A nearly grey morning, traced slowly across five songs until the light arrives.', 'published', 'bundled-cover-railway-dawn', '1755475200000', '5', '1106000', '1755475200000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_releases WHERE slug = 'grey-morning');
--> statement-breakpoint
INSERT INTO music_releases (id, slug, title, english_title, type, description_markdown, status, cover_media_id, release_date, declared_track_count, declared_duration_ms, published_at, created_at, updated_at) SELECT 'release-journey-without-a-terminus', 'journey-without-a-terminus', '終点のない旅', 'A journey without a terminus', 'ost', 'A journey without a terminus — soundtrack music for roads that refuse to end.', 'published', 'bundled-cover-white-field', '1743638400000', '7', '1574000', '1743638400000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_releases WHERE slug = 'journey-without-a-terminus');
--> statement-breakpoint
INSERT INTO music_releases (id, slug, title, english_title, type, description_markdown, status, cover_media_id, release_date, declared_track_count, declared_duration_ms, published_at, created_at, updated_at) SELECT 'release-sound-that-clears-the-night', 'sound-that-clears-the-night', '夜を澄かす音', 'A sound that clears the night', 'single', 'A sound that clears the night: four songs recorded for the hours after midnight.', 'published', 'bundled-cover-rain-city', '1734825600000', '4', '789000', '1734825600000', strftime('%s','now') * 1000, strftime('%s','now') * 1000 WHERE NOT EXISTS (SELECT 1 FROM music_releases WHERE slug = 'sound-that-clears-the-night');
