"""Split data/ into write batches (max 50 documents each) for loading the page's database.

    python3 tools/seed_batches.py OUT_DIR

Each OUT_DIR/batch-NN.json is a list of {op, collection, doc_id, file_path} writes,
the shape Claude's ArtifactData 'batch' action takes. Used once to load the 743 questions;
only needed again to rebuild the database from scratch.
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else 'batches'
os.makedirs(out, exist_ok=True)
qd = os.path.join(ROOT, 'data', 'questions')
w = [{'op': 'set', 'collection': 'meta', 'doc_id': m, 'file_path': os.path.join(ROOT, 'data', 'meta', m + '.json')} for m in ('bank', 'patterns')]
w += [{'op': 'set', 'collection': 'questions', 'doc_id': f[:-5], 'file_path': os.path.join(qd, f)} for f in sorted(os.listdir(qd))]
for n in range(0, len(w), 50):
    json.dump(w[n:n + 50], open(os.path.join(out, 'batch-%02d.json' % (n // 50)), 'w'), indent=1)
print(len(w), 'writes in', (len(w) + 49) // 50, 'batches ->', out)
