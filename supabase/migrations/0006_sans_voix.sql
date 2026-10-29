-- L'assistante n'a plus de voix (lecture à voix haute retirée le 29/10/2026) : le réglage ne sert plus, il disparaît.
alter table public.profiles drop column assistant_voice;
