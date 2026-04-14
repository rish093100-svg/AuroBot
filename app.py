import json
import os
import webbrowser
from flask import Flask, request, jsonify, render_template, send_from_directory
from difflib import SequenceMatcher

app = Flask(__name__, template_folder="templates", static_folder="static")

# ── Load decision tree JSON ──────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "data", "aurobindo_college_decision_tree.json")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    DATA = json.load(f)

TREE   = DATA["decision_tree"]
NODES  = TREE["nodes"]
ROOT   = TREE["root"]
FAQS   = DATA.get("faq", [])
BOT    = DATA.get("bot", {})

# ── Helpers ──────────────────────────────────────────────────────────────────

def get_node(node_id: str) -> dict | None:
    """Return root or any named node."""
    if node_id == "start":
        return ROOT
    return NODES.get(node_id)


def fuzzy_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def search_faq(query: str) -> dict | None:
    """Return the best-matching FAQ entry if score > threshold."""
    best_score = 0.0
    best_faq   = None
    q_lower    = query.lower()
    for faq in FAQS:
        # keyword overlap + sequence similarity
        question_lower = faq["question"].lower()
        score = fuzzy_score(q_lower, question_lower)
        # bonus for keyword hits
        words = [w for w in q_lower.split() if len(w) > 3]
        for w in words:
            if w in question_lower:
                score += 0.15
        if score > best_score:
            best_score = score
            best_faq   = faq
    if best_score > 0.38 and best_faq:
        return best_faq
    return None


def search_nodes(query: str) -> dict | None:
    """Full-text search across node messages, responses, and details."""
    q = query.lower()
    best_score = 0.0
    best_node  = None

    # keywords → node mapping for quick shortcuts
    KEYWORD_MAP = {
        ("admission", "apply", "joining", "enroll"): "admissions",
        ("fee", "fees", "payment", "cost", "charges"): "fee_structure",
        ("seat", "seats", "available"): "course_seats",
        ("course", "syllabus", "programme", "program"): "courses",
        ("department", "dept"): "departments",
        ("science",): "science_depts",
        ("commerce", "arts", "humanities"): "arts_commerce_depts",
        ("timetable", "time table", "schedule"): "time_table",
        ("exam", "examination", "datesheet"): "examination",
        ("placement", "internship", "job", "recruit"): "placement",
        ("scholarship", "financial aid", "fund"): "scholarships",
        ("library",): "library",
        ("lab", "laboratory"): "laboratories",
        ("ncc",): "ncc",
        ("nss",): "nss",
        ("sports", "medal", "game"): "sports",
        ("alumni",): "alumni",
        ("grievance", "complaint", "ragging"): "grievance",
        ("principal", "prof. arun"): "principal",
        ("contact", "phone", "email", "address"): "contact",
        ("research", "journal", "conference", "publication"): "research",
        ("hostel",): None,   # not available – handled gracefully
        ("canteen", "food"): "facility_canteen",
        ("medical", "doctor", "nurse", "health"): "facility_medical",
        ("eca", "extra curricular activity", "cultural"): "eca_admission",
        ("nep", "ugcf"): "nep_structure",
        ("calendar", "holiday"): "academic_calendar",
        ("elective", "ge", "sec", "vac", "aec"): "elective_papers",
    }

    for keywords, node_id in KEYWORD_MAP.items():
        for kw in keywords:
            if kw in q:
                if node_id:
                    return get_node(node_id)
                else:
                    return None   # topic exists but not in college

    # fuzzy fallback
    for node_id, node in NODES.items():
        text = " ".join(filter(None, [
            node.get("message", ""),
            node.get("response", ""),
            str(node.get("details", ""))
        ]))
        score = fuzzy_score(q, text[:200])
        if score > best_score:
            best_score = score
            best_node  = node

    if best_score > 0.25 and best_node:
        return best_node
    return None


def build_response(node: dict) -> dict:
    """Serialise a node into a clean API response dict."""
    return {
        "id":       node.get("id", ""),
        "message":  node.get("message", ""),
        "response": node.get("response", ""),
        "details":  node.get("details", {}),
        "options":  node.get("options", []),
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", bot=BOT)


@app.route("/api/start", methods=["GET"])
def api_start():
    """Return the root/welcome node."""
    return jsonify(build_response(ROOT))


@app.route("/api/node/<node_id>", methods=["GET"])
def api_node(node_id: str):
    """Return a specific node by ID."""
    node = get_node(node_id)
    if not node:
        return jsonify({"error": f"Node '{node_id}' not found."}), 404
    return jsonify(build_response(node))


@app.route("/api/search", methods=["POST"])
def api_search():
    """
    Free-text search: checks FAQs first, then node keyword map, then fuzzy.
    Body: { "query": "..." }
    """
    body  = request.get_json(force=True, silent=True) or {}
    query = body.get("query", "").strip()
    if not query:
        return jsonify({"error": "Empty query."}), 400

    # 1. FAQ match
    faq = search_faq(query)
    if faq:
        return jsonify({
            "type":     "faq",
            "question": faq["question"],
            "answer":   faq["answer"],
            "options":  [{"label": "🏠 Main Menu", "next": "start"},
                         {"label": "🔍 Search Again", "action": "search"}]
        })

    # 2. Hostel – common question not available
    if any(w in query.lower() for w in ("hostel", "accommodation", "pg", "dormitory")):
        return jsonify({
            "type":    "not_found",
            "message": "ℹ️ Sri Aurobindo College (Morning) does not have on-campus hostel facilities. "
                       "You may explore PG accommodation near Malviya Nagar Metro Station.",
            "options": [{"label": "🏠 Main Menu", "next": "start"}]
        })

    # 3. Node search
    node = search_nodes(query)
    if node:
        resp = build_response(node)
        resp["type"] = "node"
        return jsonify(resp)

    # 4. Fallback
    return jsonify({
        "type":    "not_found",
        "message": "🤔 I couldn't find specific information about that. "
                   "Try browsing the menu or contact the college directly.",
        "details": {
            "phone": BOT.get("phone"),
            "email": BOT.get("email"),
        },
        "options": [
            {"label": "🏠 Main Menu",  "next": "start"},
            {"label": "📞 Contact Us", "next": "contact"},
        ]
    })


@app.route("/api/faq", methods=["GET"])
def api_faq():
    """Return all FAQs."""
    return jsonify(FAQS)


@app.route("/api/bot-info", methods=["GET"])
def api_bot_info():
    """Return bot/college metadata."""
    return jsonify(BOT)

if __name__ == "__main__":
    webbrowser.open("http://127.0.0.1:5000")
    app.run(debug=True, use_reloader=False)