-- Removes the one test row written during verification of the submit_score hotfix
-- (a 210ms Reaction "score" that was never an actual play) — run once.
delete from public.scores
where owner_id = '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1'
  and game_id = 'reaction';
