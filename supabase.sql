-- ============================================================================
-- CLUB AÉROSPATIAL D'ABIDJAN (CAA) - SCRIPT D'INITIALISATION SUPABASE
-- ============================================================================
-- Ce script configure :
-- 1. La table des inscriptions (membres du club) avec sécurité RLS.
-- 2. La fonction SECURITY DEFINER permettant l'authentification des membres
--    sans jamais exposer la table ni les empreintes de mots de passe.
-- 3. Le seau de stockage public 'medias' pour les photos et vidéos.
-- ============================================================================

-- 1. CRÉATION DE L'EXTENSION UUID SI NÉCESSAIRE
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE DES INSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telephone TEXT,
  mot_de_passe TEXT NOT NULL, -- Empreinte SHA-256 uniquement
  statut TEXT NOT NULL DEFAULT 'en_attente', -- 'en_attente', 'valide', 'actif'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour accélérer les recherches et garantir la cohérence
CREATE INDEX IF NOT EXISTS idx_inscriptions_email ON public.inscriptions(lower(email));
CREATE INDEX IF NOT EXISTS idx_inscriptions_created_at ON public.inscriptions(created_at DESC);

-- 3. ACTIVATION DU ROW LEVEL SECURITY (RLS)
ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;

-- Politique A : Dépôt public d'une inscription (tout visiteur peut s'inscrire)
DROP POLICY IF EXISTS "Permettre l'inscription publique" ON public.inscriptions;
CREATE POLICY "Permettre l'inscription publique"
ON public.inscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Politique B : Lecture réservée aux administrateurs connectés
DROP POLICY IF EXISTS "Lecture réservée aux administrateurs" ON public.inscriptions;
CREATE POLICY "Lecture réservée aux administrateurs"
ON public.inscriptions
FOR SELECT
TO authenticated
USING (true);

-- Politique C : Suppression réservée aux administrateurs
DROP POLICY IF EXISTS "Suppression réservée aux administrateurs" ON public.inscriptions;
CREATE POLICY "Suppression réservée aux administrateurs"
ON public.inscriptions
FOR DELETE
TO authenticated
USING (true);

-- Politique D : Mise à jour du statut réservée aux administrateurs
DROP POLICY IF EXISTS "Mise a jour réservée aux administrateurs" ON public.inscriptions;
CREATE POLICY "Mise a jour réservée aux administrateurs"
ON public.inscriptions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- 4. FONCTION SECURITY DEFINER : VÉRIFICATION DE CONNEXION D'UN MEMBRE
-- Cette fonction permet au visiteur de vérifier son couple (email + hash SHA-256)
-- sans qu'il ait besoin d'accéder directement en SELECT à la table 'inscriptions'.
CREATE OR REPLACE FUNCTION public.connexion_membre(p_email TEXT, p_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre RECORD;
BEGIN
  -- Recherche insensible à la casse
  SELECT id, nom, email, statut, created_at
  INTO v_membre
  FROM public.inscriptions
  WHERE lower(email) = lower(trim(p_email))
    AND mot_de_passe = p_hash;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'id', v_membre.id,
      'nom', v_membre.nom,
      'email', v_membre.email,
      'statut', v_membre.statut
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Adresse e-mail ou mot de passe incorrect'
    );
  END IF;
END;
$$;

-- Autorisation d'exécution pour les visiteurs anonymes et authentifiés
GRANT EXECUTE ON FUNCTION public.connexion_membre(TEXT, TEXT) TO anon, authenticated;


-- 5. CONFIGURATION DU SEAU DE STOCKAGE 'medias' (Storage)
-- Création du bucket public s'il n'existe pas encore
INSERT INTO storage.buckets (id, name, public)
VALUES ('medias', 'medias', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politique de lecture publique pour les images et vidéos
DROP POLICY IF EXISTS "Lecture publique medias" ON storage.objects;
CREATE POLICY "Lecture publique medias"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'medias');

-- Politique de téléversement (admin ou requêtes autorisées)
DROP POLICY IF EXISTS "Depot medias autorise" ON storage.objects;
CREATE POLICY "Depot medias autorise"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'medias');

-- Politique de suppression des médias
DROP POLICY IF EXISTS "Suppression medias autorisee" ON storage.objects;
CREATE POLICY "Suppression medias autorisee"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'medias');


-- ============================================================================
-- 6. DONNÉES DE TEST OPTIONNELLES POUR LA TABLE INSCRIPTIONS
-- Décommentez les lignes suivantes si vous souhaitez injecter des tests en base :
-- ============================================================================
-- INSERT INTO public.inscriptions (nom, email, telephone, mot_de_passe, statut)
-- VALUES 
--   ('Koffi Marc-Aurel', 'koffi.marc@aeroclub-abidjan.ci', '+225 07 01 02 03 04', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'valide'),
--   ('Aminata Touré', 'aminata.toure@inphb.ci', '+225 05 55 44 33 22', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'en_attente');

