import json
import subprocess


def looks_like_instruction_text(value):
    if not value:
        return False
    lowered = str(value).lower().strip()
    markers = [
        "ao contrario", "ao contrário", "troca", "swap", "invert", "corrige", "correc", "correct",
        "cliente", "fornecedor", "vendor", "customer", "client", "nif", "data de vencimento"
    ]
    return any(m in lowered for m in markers) and len(lowered.split()) > 3


def run(sql):
    cmd = ["docker", "exec", "viacontab-postgres", "psql", "-U", "viacontab", "-d", "viacontab", "-At", "-F", "\t", "-c", sql]
    return subprocess.check_output(cmd, text=True)


def sanitize_table(table, keys):
    rows = run(f"select id, payload from {table};").splitlines()
    for row in rows:
        if not row.strip():
            continue
        rid, payload = row.split("\t", 1)
        data = json.loads(payload)
        changed = False
        for key in keys:
            if looks_like_instruction_text(data.get(key)):
                data[key] = None
                changed = True
        if changed:
            escaped = json.dumps(data).replace("'", "''")
            run(f"update {table} set payload = '{escaped}' where id = '{rid}';")


sanitize_table("vendor_profiles", ["vendor", "vendor_address", "vendor_contact", "supplier_nif", "category", "currency", "customer_name", "customer_nif", "notes"])
sanitize_table("invoice_templates", ["vendor", "vendor_address", "vendor_contact", "supplier_nif", "category", "currency", "customer_name", "customer_nif", "invoice_number", "invoice_date", "due_date", "notes"])
print("sanitized")
