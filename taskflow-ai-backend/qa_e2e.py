#!/usr/bin/env python3
"""
TaskFlow AI — QA End-to-End completo
Simula exactamente lo que haría el browser via nginx proxy
"""

import json
import sys
import requests

BASE_URL = "http://53.103.13.238:5300/api"
WORKSPACE_ID = "78e2417a-cb04-4a2f-9312-beb66a9ce466"
ADMIN_EMAIL = "admin@taskflow.ai"
ADMIN_PASSWORD = "Admin2026"

# Headers base como los envía el browser
BROWSER_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "http://53.103.13.238:5300",
    "Referer": "http://53.103.13.238:5300/",
}

results = []
state = {}

def log(emoji, test, detail="", status_code=None, body=None):
    sc = f" [{status_code}]" if status_code else ""
    print(f"{emoji} {test}{sc}")
    if detail:
        print(f"   → {detail}")
    if body and emoji == "❌":
        body_str = json.dumps(body, indent=2, ensure_ascii=False) if isinstance(body, dict) else str(body)
        print(f"   Body: {body_str[:400]}")
    results.append({"emoji": emoji, "test": test, "detail": detail, "status_code": status_code})

def post(path, payload, token=None, label=""):
    headers = dict(BROWSER_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.post(f"{BASE_URL}{path}", json=payload, headers=headers, timeout=15)
        return r
    except Exception as e:
        log("❌", label or path, f"Connection error: {e}")
        return None

def get(path, token=None, label=""):
    headers = dict(BROWSER_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15)
        return r
    except Exception as e:
        log("❌", label or path, f"Connection error: {e}")
        return None

def put(path, payload, token=None, label=""):
    headers = dict(BROWSER_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.put(f"{BASE_URL}{path}", json=payload, headers=headers, timeout=15)
        return r
    except Exception as e:
        log("❌", label or path, f"Connection error: {e}")
        return None

def delete(path, token=None, label=""):
    headers = dict(BROWSER_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.delete(f"{BASE_URL}{path}", headers=headers, timeout=15)
        return r
    except Exception as e:
        log("❌", label or path, f"Connection error: {e}")
        return None

print("=" * 60)
print("  TASKFLOW AI — QA END-TO-END")
print("=" * 60)
print()

# ─────────────────────────────────────────────
# 1. LOGIN — credenciales incorrectas
# ─────────────────────────────────────────────
print("── TEST 1: LOGIN con credenciales incorrectas ──")
r = post("/auth/login", {"email": ADMIN_EMAIL, "password": "wrong"}, label="Login incorrecto")
if r is not None:
    if r.status_code == 401:
        body = r.json() if r.content else {}
        error_msg = body.get("error", body.get("message", ""))
        if "nválidas" in error_msg or "invalid" in error_msg.lower() or "credentials" in error_msg.lower():
            log("✅", "Login incorrecto → 401 con error correcto", f'error="{error_msg}"', r.status_code)
        elif "expirada" in error_msg.lower() or "expired" in error_msg.lower():
            log("❌", "Login incorrecto → 401 pero con mensaje INCORRECTO", f'Esperaba "Credenciales inválidas", got "{error_msg}"', r.status_code, body)
        else:
            log("⚠️", "Login incorrecto → 401 pero mensaje inesperado", f'error="{error_msg}"', r.status_code)
    else:
        body = r.json() if r.content else {}
        log("❌", "Login incorrecto → status incorrecto", f"Esperaba 401, got {r.status_code}", r.status_code, body)
print()

# ─────────────────────────────────────────────
# 2. LOGIN — credenciales correctas
# ─────────────────────────────────────────────
print("── TEST 2: LOGIN con credenciales correctas ──")
r = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, label="Login correcto")
if r is not None:
    if r.status_code in (200, 201):
        body = r.json() if r.content else {}
        token = body.get("token") or body.get("accessToken") or body.get("access_token")
        user = body.get("user", {})
        if token:
            state["token"] = token
            state["admin_user_id"] = user.get("id") or body.get("userId")
            log("✅", "Login correcto → token recibido", f"userId={state['admin_user_id']}", r.status_code)
        else:
            log("❌", "Login correcto → sin token en respuesta", f"keys: {list(body.keys())}", r.status_code, body)
    else:
        body = r.json() if r.content else {}
        log("❌", "Login correcto → status incorrecto", f"Esperaba 200, got {r.status_code}", r.status_code, body)
print()

TOKEN = state.get("token")
if not TOKEN:
    print("❌ Sin token, no se puede continuar. Abortando.")
    sys.exit(1)

# ─────────────────────────────────────────────
# 3. WORKSPACE
# ─────────────────────────────────────────────
print("── TEST 3: WORKSPACE ──")

r = get("/workspaces", TOKEN, "GET /workspaces")
if r is not None:
    if r.status_code == 200:
        body = r.json() if r.content else []
        workspaces = body if isinstance(body, list) else body.get("workspaces", body.get("data", []))
        log("✅", "GET /workspaces → lista obtenida", f"count={len(workspaces)}", r.status_code)
        # Guardar IDs disponibles
        state["all_workspaces"] = workspaces
    else:
        log("❌", "GET /workspaces", f"status={r.status_code}", r.status_code, r.json() if r.content else {})

r = get(f"/workspaces/{WORKSPACE_ID}", TOKEN, "GET /workspaces/:id")
if r is not None:
    if r.status_code == 200:
        body = r.json() if r.content else {}
        ws = body.get("workspace", body)
        members = ws.get("members", [])
        name = ws.get("name", "?")
        log("✅", "GET /workspaces/:id → detalle obtenido", f'name="{name}", members={len(members)}', r.status_code)
        if not members:
            log("⚠️", "Workspace sin members en respuesta", "¿El endpoint popula members?")
    else:
        log("❌", "GET /workspaces/:id", f"status={r.status_code}", r.status_code, r.json() if r.content else {})
print()

# ─────────────────────────────────────────────
# 4. BOARD — ciclo completo
# ─────────────────────────────────────────────
print("── TEST 4: BOARD ciclo completo ──")

r = post("/boards", {"workspaceId": WORKSPACE_ID, "name": "QA Test Board"}, TOKEN, "POST /boards")
if r is not None:
    if r.status_code in (200, 201):
        body = r.json() if r.content else {}
        board = body.get("board", body)
        state["board_id"] = board.get("id")
        log("✅", "POST /boards → board creado", f"boardId={state['board_id']}", r.status_code)
    else:
        body = r.json() if r.content else {}
        log("❌", "POST /boards", f"status={r.status_code}", r.status_code, body)

if state.get("board_id"):
    r = get(f"/boards/{state['board_id']}", TOKEN, "GET /boards/:id")
    if r is not None:
        if r.status_code == 200:
            body = r.json() if r.content else {}
            board = body.get("board", body)
            groups = board.get("groups", [])
            group_names = [g.get("name", "") for g in groups]
            default_group = next((g for g in groups if g.get("name") in ["Tareas", "Tasks", "Default"]), None)
            if default_group:
                state["default_group_id"] = default_group.get("id")
                log("✅", "GET /boards/:id → tiene grupo default", f"grupos={group_names}", r.status_code)
            else:
                log("⚠️", "GET /boards/:id → sin grupo 'Tareas' default", f"grupos existentes={group_names}", r.status_code)
                # Usar primer grupo disponible
                if groups:
                    state["default_group_id"] = groups[0].get("id")
        else:
            log("❌", "GET /boards/:id", f"status={r.status_code}", r.status_code, r.json() if r.content else {})

    # Crear grupo Backlog
    r = post(f"/boards/{state['board_id']}/groups", {"name": "Backlog", "color": "#6366f1"}, TOKEN, "POST grupos Backlog")
    if r is not None:
        if r.status_code in (200, 201):
            body = r.json() if r.content else {}
            grp = body.get("group", body)
            state["backlog_group_id"] = grp.get("id")
            log("✅", "POST grupos → Backlog creado", f"groupId={state['backlog_group_id']}", r.status_code)
        else:
            body = r.json() if r.content else {}
            log("❌", "POST grupos Backlog", f"status={r.status_code}", r.status_code, body)

    # Verificar ambos grupos
    r = get(f"/boards/{state['board_id']}", TOKEN)
    if r is not None and r.status_code == 200:
        body = r.json() if r.content else {}
        board = body.get("board", body)
        groups = board.get("groups", [])
        if len(groups) >= 2:
            log("✅", "GET /boards/:id → ambos grupos presentes", f"count={len(groups)}", r.status_code)
        else:
            log("⚠️", "GET /boards/:id → menos de 2 grupos", f"groups={[g.get('name') for g in groups]}", r.status_code)
print()

# ─────────────────────────────────────────────
# 5. TASKS — ciclo completo
# ─────────────────────────────────────────────
print("── TEST 5: TASKS ciclo completo ──")

group_id = state.get("default_group_id") or state.get("backlog_group_id")
if not group_id:
    log("⚠️", "TASKS: sin groupId disponible, saltando ciclo de tareas")
else:
    task_payload = {
        "title": "QA Test Task",
        "groupId": group_id,
        "boardId": state.get("board_id"),
        "status": "Nuevo",
        "priority": "Alta"
    }
    r = post("/tasks", task_payload, TOKEN, "POST /tasks")
    if r is not None:
        if r.status_code in (200, 201):
            body = r.json() if r.content else {}
            task = body.get("task", body)
            state["task_id"] = task.get("id")
            log("✅", "POST /tasks → tarea creada", f"taskId={state['task_id']}", r.status_code)
        else:
            body = r.json() if r.content else {}
            log("❌", "POST /tasks", f"status={r.status_code}", r.status_code, body)

    if state.get("task_id"):
        # GET task
        r = get(f"/tasks/{state['task_id']}", TOKEN)
        if r is not None:
            if r.status_code == 200:
                body = r.json() if r.content else {}
                t = body.get("task", body)
                log("✅", "GET /tasks/:id → tarea obtenida", f"title={t.get('title','?')}, status={t.get('status','?')}", r.status_code)
            else:
                log("❌", "GET /tasks/:id", f"status={r.status_code}", r.status_code, r.json() if r.content else {})

        # PUT assign
        admin_id = state.get("admin_user_id")
        if admin_id:
            r = put(f"/tasks/{state['task_id']}", {"assigneeIds": [admin_id]}, TOKEN)
            if r is not None:
                if r.status_code == 200:
                    body = r.json() if r.content else {}
                    t = body.get("task", body)
                    assignees = t.get("assignees", []) or t.get("assigneeIds", [])
                    if assignees:
                        log("✅", "PUT /tasks/:id assigneeIds → asignado", f"assignees={assignees}", r.status_code)
                    else:
                        log("⚠️", "PUT /tasks/:id assigneeIds → 200 pero sin assignees en respuesta", "", r.status_code)
                else:
                    body = r.json() if r.content else {}
                    log("❌", "PUT /tasks/:id assigneeIds", f"status={r.status_code}", r.status_code, body)

            # Verificar assignee
            r = get(f"/tasks/{state['task_id']}", TOKEN)
            if r is not None and r.status_code == 200:
                body = r.json() if r.content else {}
                t = body.get("task", body)
                assignees = t.get("assignees", []) or t.get("assigneeIds", [])
                if assignees:
                    log("✅", "GET /tasks/:id → tiene assignee confirmado", f"assignees={assignees}", r.status_code)
                else:
                    log("⚠️", "GET /tasks/:id → sin assignees persistidos", "", r.status_code)

        # POST comment
        r = post(f"/tasks/{state['task_id']}/comments", {"content": "Comentario de prueba"}, TOKEN)
        if r is not None:
            if r.status_code in (200, 201):
                body = r.json() if r.content else {}
                comment = body.get("comment", body)
                log("✅", "POST /tasks/:id/comments → comentario creado", f"commentId={comment.get('id','?')}", r.status_code)
            else:
                body = r.json() if r.content else {}
                log("❌", "POST /tasks/:id/comments", f"status={r.status_code}", r.status_code, body)

        # Mover tarea al otro grupo
        other_group = state.get("backlog_group_id") if group_id == state.get("default_group_id") else state.get("default_group_id")
        if other_group:
            r = put(f"/tasks/{state['task_id']}", {"groupId": other_group}, TOKEN)
            if r is not None:
                if r.status_code == 200:
                    body = r.json() if r.content else {}
                    t = body.get("task", body)
                    new_gid = t.get("groupId", "?")
                    if str(new_gid) == str(other_group):
                        log("✅", "PUT /tasks/:id groupId → tarea movida", f"new groupId={new_gid}", r.status_code)
                    else:
                        log("⚠️", "PUT /tasks/:id groupId → 200 pero groupId no coincide", f"esperaba={other_group}, got={new_gid}", r.status_code)
                else:
                    body = r.json() if r.content else {}
                    log("❌", "PUT /tasks/:id groupId (mover)", f"status={r.status_code}", r.status_code, body)

            # Verificar nuevo groupId
            r = get(f"/tasks/{state['task_id']}", TOKEN)
            if r is not None and r.status_code == 200:
                body = r.json() if r.content else {}
                t = body.get("task", body)
                current_gid = t.get("groupId", "?")
                if str(current_gid) == str(other_group):
                    log("✅", "GET /tasks/:id → nuevo groupId confirmado", f"groupId={current_gid}", r.status_code)
                else:
                    log("⚠️", "GET /tasks/:id → groupId no refleja el movimiento", f"esperaba={other_group}, got={current_gid}", r.status_code)
        else:
            log("⚠️", "Sin segundo grupo disponible para mover tarea")
print()

# ─────────────────────────────────────────────
# 6. AUTOMATIONS
# ─────────────────────────────────────────────
print("── TEST 6: AUTOMATIONS ──")

if state.get("board_id"):
    auto_payload = {
        "triggerEvent": "status_changed",
        "actionType": "set_priority",
        "config": {"priority": "Alta"}
    }
    r = post(f"/boards/{state['board_id']}/automations", auto_payload, TOKEN)
    if r is not None:
        if r.status_code in (200, 201):
            body = r.json() if r.content else {}
            auto = body.get("automation", body)
            state["automation_id"] = auto.get("id")
            log("✅", "POST automations → creada", f"autoId={state['automation_id']}", r.status_code)
        else:
            body = r.json() if r.content else {}
            log("❌", "POST automations", f"status={r.status_code}", r.status_code, body)

    r = get(f"/boards/{state['board_id']}/automations", TOKEN)
    if r is not None:
        if r.status_code == 200:
            body = r.json() if r.content else {}
            autos = body if isinstance(body, list) else body.get("automations", body.get("data", []))
            # Verificar config persistida
            found = next((a for a in autos if a.get("id") == state.get("automation_id")), None)
            if found:
                config = found.get("config", {})
                if config.get("priority") == "Alta":
                    log("✅", "GET automations → config persistida correctamente", f"config={config}", r.status_code)
                else:
                    log("⚠️", "GET automations → config distinta", f"config={config}", r.status_code)
            else:
                log("⚠️", "GET automations → automation creada no encontrada en lista", f"ids={[a.get('id') for a in autos]}", r.status_code)
        else:
            log("❌", "GET automations", f"status={r.status_code}", r.status_code, r.json() if r.content else {})

    if state.get("automation_id"):
        r = put(f"/automations/{state['automation_id']}", {"enabled": False}, TOKEN)
        if r is not None:
            if r.status_code == 200:
                body = r.json() if r.content else {}
                a = body.get("automation", body)
                log("✅", "PUT /automations/:id enabled=false → deshabilitada", f"enabled={a.get('enabled','?')}", r.status_code)
            else:
                body = r.json() if r.content else {}
                log("❌", "PUT /automations/:id enabled=false", f"status={r.status_code}", r.status_code, body)

        r = delete(f"/automations/{state['automation_id']}", TOKEN)
        if r is not None:
            if r.status_code in (200, 204):
                log("✅", "DELETE /automations/:id → eliminada", "", r.status_code)
            else:
                body = r.json() if r.content else {}
                log("❌", "DELETE /automations/:id", f"status={r.status_code}", r.status_code, body)
else:
    log("⚠️", "AUTOMATIONS: sin boardId, saltando")
print()

# ─────────────────────────────────────────────
# 7. WORKSPACE STATUSES
# ─────────────────────────────────────────────
print("── TEST 7: WORKSPACE STATUSES ──")

r = get(f"/workspaces/{WORKSPACE_ID}/statuses", TOKEN)
if r is not None:
    if r.status_code == 200:
        body = r.json() if r.content else {}
        statuses = body if isinstance(body, list) else body.get("statuses", body.get("data", []))
        log("✅", "GET /workspaces/:id/statuses", f"count={len(statuses)}", r.status_code)
    else:
        log("❌", "GET /workspaces/:id/statuses", f"status={r.status_code}", r.status_code, r.json() if r.content else {})

r = post(f"/workspaces/{WORKSPACE_ID}/statuses", {"label": "En QA", "color": "#8b5cf6"}, TOKEN)
if r is not None:
    if r.status_code in (200, 201):
        body = r.json() if r.content else {}
        st = body.get("status", body)
        state["status_id"] = st.get("id")
        log("✅", "POST /workspaces/:id/statuses → 'En QA' creado", f"statusId={state['status_id']}", r.status_code)
    else:
        body = r.json() if r.content else {}
        log("❌", "POST /workspaces/:id/statuses", f"status={r.status_code}", r.status_code, body)

if state.get("status_id"):
    r = put(f"/workspaces/{WORKSPACE_ID}/statuses/{state['status_id']}", {"color": "#ff0000"}, TOKEN)
    if r is not None:
        if r.status_code == 200:
            body = r.json() if r.content else {}
            st = body.get("status", body)
            log("✅", "PUT /workspaces/:id/statuses/:id → color actualizado", f"color={st.get('color','?')}", r.status_code)
        else:
            body = r.json() if r.content else {}
            log("❌", "PUT /workspaces/:id/statuses/:id", f"status={r.status_code}", r.status_code, body)

    # Verificar
    r = get(f"/workspaces/{WORKSPACE_ID}/statuses", TOKEN)
    if r is not None and r.status_code == 200:
        body = r.json() if r.content else {}
        statuses = body if isinstance(body, list) else body.get("statuses", body.get("data", []))
        updated = next((s for s in statuses if s.get("id") == state["status_id"]), None)
        if updated and updated.get("color") == "#ff0000":
            log("✅", "GET /workspaces/:id/statuses → color #ff0000 confirmado", "", r.status_code)
        elif updated:
            log("⚠️", "GET /workspaces/:id/statuses → color no actualizado", f"color={updated.get('color','?')}", r.status_code)
        else:
            log("⚠️", "GET /workspaces/:id/statuses → status creado no encontrado", "", r.status_code)
print()

# ─────────────────────────────────────────────
# 8. INVITE — link method
# ─────────────────────────────────────────────
print("── TEST 8: INVITE FLOW — link method ──")

r = post(f"/workspaces/{WORKSPACE_ID}/invite",
         {"email": "test.invite@grupocondor.com.py", "role": "MEMBER", "sendEmail": False},
         TOKEN)
if r is not None:
    if r.status_code in (200, 201):
        body = r.json() if r.content else {}
        invite_url = body.get("inviteUrl") or body.get("invite_url") or body.get("url")
        if invite_url:
            has_token = "/workspaces/accept/" in invite_url or "/accept/" in invite_url or "token=" in invite_url
            if has_token:
                log("✅", "POST invite (link) → inviteUrl correcto", f"url={invite_url}", r.status_code)
            else:
                log("⚠️", "POST invite (link) → inviteUrl con formato inesperado", f"url={invite_url}", r.status_code)
        else:
            log("⚠️", "POST invite (link) → 200 pero sin inviteUrl", f"keys={list(body.keys())}", r.status_code)
    else:
        body = r.json() if r.content else {}
        log("❌", "POST invite (link method)", f"status={r.status_code}", r.status_code, body)
print()

# ─────────────────────────────────────────────
# 9. INVITE — email method
# ─────────────────────────────────────────────
print("── TEST 9: INVITE FLOW — email method ──")

r = post(f"/workspaces/{WORKSPACE_ID}/invite",
         {"email": "test.invite2@grupocondor.com.py", "role": "MEMBER", "sendEmail": True},
         TOKEN)
if r is not None:
    if r.status_code in (200, 201):
        body = r.json() if r.content else {}
        invite_url = body.get("inviteUrl") or body.get("invite_url") or body.get("url")
        if invite_url:
            log("✅", "POST invite (email) → inviteUrl generado", f"url={invite_url}", r.status_code)
        else:
            log("⚠️", "POST invite (email) → 200 sin inviteUrl en body", f"keys={list(body.keys())}", r.status_code)
    else:
        body = r.json() if r.content else {}
        log("❌", "POST invite (email method)", f"status={r.status_code}", r.status_code, body)
print()

# ─────────────────────────────────────────────
# 10. CLEANUP
# ─────────────────────────────────────────────
print("── TEST 10: CLEANUP ──")

if state.get("board_id"):
    r = delete(f"/boards/{state['board_id']}", TOKEN)
    if r is not None:
        if r.status_code in (200, 204):
            log("✅", "DELETE /boards/:id → board eliminado", f"boardId={state['board_id']}", r.status_code)
        else:
            body = r.json() if r.content else {}
            log("❌", "DELETE /boards/:id", f"status={r.status_code}", r.status_code, body)
else:
    log("⚠️", "CLEANUP: sin boardId para eliminar")
print()

# ─────────────────────────────────────────────
# RESUMEN EJECUTIVO
# ─────────────────────────────────────────────
print("=" * 60)
print("  RESUMEN EJECUTIVO")
print("=" * 60)

passed = [r for r in results if r["emoji"] == "✅"]
failed = [r for r in results if r["emoji"] == "❌"]
warns  = [r for r in results if r["emoji"] == "⚠️"]

print(f"\n✅ PASS:  {len(passed)}")
print(f"❌ FAIL:  {len(failed)}")
print(f"⚠️  WARN:  {len(warns)}")
print(f"Total:   {len(results)}")

if failed:
    print("\n── Fallos críticos ──")
    for f in failed:
        print(f"  ❌ [{f['status_code']}] {f['test']}: {f['detail']}")

if warns:
    print("\n── Advertencias ──")
    for w in warns:
        print(f"  ⚠️  {w['test']}: {w['detail']}")

print()
