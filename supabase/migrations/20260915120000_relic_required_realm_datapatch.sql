-- Data patch: assign realm requirements to the listed relics.
-- Caro, Aequor, and Ultra families each require their base realm.

UPDATE public.relic r
SET required_realm = realm.id
FROM public.realm realm
WHERE realm.name = 'caro'
  AND r.name IN (
    'Rusted Saw',
    'Plague Record',
    'Gilded Reverie',
    'Bloody Pebble',
    'Phantom Hand',
    'Dearest Babe',
    'Wriggling Cord'
  );

UPDATE public.relic r
SET required_realm = realm.id
FROM public.realm realm
WHERE realm.name = 'aequor'
  AND r.name IN (
    'Chant of the Tides',
    'Severed Head Worm',
    'Nameless Appendage',
    'Lemurian Delight',
    'Yellow Snail',
    'Submersible Helm',
    'Sacred Agony'
  );

UPDATE public.relic r
SET required_realm = realm.id
FROM public.realm realm
WHERE realm.name = 'ultra'
  AND r.name IN (
    'Alfonso''s Artifact',
    'Luminous Hourglass',
    'Time Scarab',
    'Hyperstring Pocketwatch',
    'Spatial Deflector',
    'Trigon Prism',
    'Swarm Mind'
  );
