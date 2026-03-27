-- Historique partagé des ingrédients ajoutés manuellement
create table if not exists ingredients_libres (
  id          uuid default gen_random_uuid() primary key,
  nom         text not null unique,
  quantite    numeric,
  unite       text,
  categorie_id uuid references categories(id) on delete set null
);

-- Liste de courses manuelle (ingrédients actifs de la liste courante)
create table if not exists liste_manuelle (
  id                   uuid default gen_random_uuid() primary key,
  ingredient_libre_id  uuid references ingredients_libres(id) on delete set null,
  nom                  text not null,
  quantite             numeric,
  unite                text,
  categorie_id         uuid references categories(id) on delete set null,
  coche                boolean not null default false
);

-- Autoriser la lecture/écriture publique (comme les autres tables)
alter table ingredients_libres enable row level security;
create policy "Public access" on ingredients_libres for all using (true) with check (true);

alter table liste_manuelle enable row level security;
create policy "Public access" on liste_manuelle for all using (true) with check (true);
