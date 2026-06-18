-- 0002_fix_touch_search_path: pin search_path on the touch trigger fn (security advisor)
alter function app.touch_updated_at() set search_path = '';
