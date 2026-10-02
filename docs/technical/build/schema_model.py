"""Parse the Prisma schema and the SQL migrations into one physical data model.

The Prisma schema is the source of the logical structure (models, fields,
relations, enums). The migration SQL is read alongside it for what only the
database knows: index and constraint names, ON DELETE actions, CHECK
constraints, sequences, functions and triggers. Every column type derived from
the Prisma schema is cross-checked against the CREATE TABLE statement in the
migrations, so the data dictionary cannot drift from the deployed database.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
API_DIR = REPO_ROOT / "apps" / "api"
SCHEMA_PATH = API_DIR / "prisma" / "schema.prisma"
MIGRATIONS_DIR = API_DIR / "prisma" / "migrations"

SCALARS = {"String", "Int", "BigInt", "Boolean", "DateTime", "Decimal", "Json", "Float", "Bytes"}


# --- Data classes ---------------------------------------------------------------------
@dataclass
class Column:
    model: str
    field: str
    name: str                    # PostgreSQL column name
    prisma_type: str
    is_list: bool
    optional: bool
    attributes: str
    pg_type: str = ""
    default: str = ""
    is_pk: bool = False
    is_unique: bool = False      # single-column unique
    indexes: list = field(default_factory=list)   # names of indexes containing the column
    fk: str = ""                 # "table(column) ON DELETE x"
    is_enum: bool = False

    @property
    def nullable(self) -> bool:
        return self.optional


@dataclass
class Relation:
    name: str                    # constraint name
    child_table: str
    child_columns: list
    parent_table: str
    parent_columns: list
    on_delete: str
    on_update: str
    child_model: str
    parent_model: str
    field: str                   # relation field on the child model
    unique_child: bool           # one-to-one when the FK column is unique


@dataclass
class Index:
    name: str
    table: str
    columns: list
    unique: bool
    primary: bool = False


@dataclass
class Model:
    name: str
    table: str
    comment: str
    columns: list = field(default_factory=list)
    relations: list = field(default_factory=list)  # relations where this model is the child
    primary_key: list = field(default_factory=list)
    section: str = ""


@dataclass
class Enum:
    name: str
    values: list


@dataclass
class PhysicalModel:
    models: list
    enums: list
    indexes: list
    relations: list
    checks: list         # (name, table, expression)
    sequences: list      # (name, start)
    functions: list      # (name, returns, body)
    triggers: list       # (name, table, timing, function)
    migrations: list     # migration folder names

    def model(self, name):
        return next(m for m in self.models if m.name == name)

    def by_table(self, table):
        return next(m for m in self.models if m.table == table)


# --- Prisma schema parser ---------------------------------------------------------
def _strip_comment(line: str) -> str:
    return line.split("//", 1)[0].rstrip()


def parse_prisma(text: str):
    models, enums = [], []
    section = ""
    lines = text.splitlines()
    i = 0
    pending_comment = []
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()
        if stripped.startswith("// ") and lines[i - 1].strip().startswith("// ----") and i + 1 < len(lines) \
                and lines[i + 1].strip().startswith("// ----"):
            section = stripped[3:].strip()
            i += 1
            continue
        if stripped.startswith("//") and not stripped.startswith("// ----"):
            pending_comment.append(stripped.lstrip("/ ").strip())
            i += 1
            continue
        match = re.match(r"^(model|enum)\s+(\w+)\s*\{", stripped)
        if not match:
            if stripped:
                pending_comment = []
            i += 1
            continue
        kind, name = match.groups()
        body = []
        i += 1
        while not lines[i].strip().startswith("}"):
            body.append(lines[i])
            i += 1
        i += 1
        if kind == "enum":
            values = [_strip_comment(b).strip() for b in body if _strip_comment(b).strip()]
            enums.append(Enum(name, values))
        else:
            models.append(_parse_model(name, body, " ".join(pending_comment), section))
        pending_comment = []
    enum_names = {e.name for e in enums}
    for model in models:
        for column in model.columns:
            column.is_enum = column.prisma_type in enum_names
    return models, enums


def _parse_model(name, body, comment, section):
    model = Model(name=name, table=name, comment=comment, section=section)
    block_attrs = []
    for raw in body:
        line = _strip_comment(raw).strip()
        if not line:
            continue
        if line.startswith("@@"):
            block_attrs.append(line)
            continue
        parts = line.split(None, 2)
        field_name, type_token = parts[0], parts[1]
        attributes = parts[2] if len(parts) > 2 else ""
        base = type_token.rstrip("?").replace("[]", "")
        is_list = type_token.endswith("[]")
        optional = type_token.endswith("?")
        if base not in SCALARS and not _looks_like_enum(base, attributes):
            # relation field: remember it to resolve foreign keys
            model.relations.append((field_name, base, attributes, optional, is_list))
            continue
        map_match = re.search(r'@map\("([^"]+)"\)', attributes)
        column = Column(model=name, field=field_name, name=map_match.group(1) if map_match else field_name,
                        prisma_type=base, is_list=is_list, optional=optional, attributes=attributes)
        column.is_pk = "@id" in re.sub(r"@@id", "", attributes) and not attributes.startswith("@@")
        column.is_unique = bool(re.search(r"@unique\b", attributes))
        model.columns.append(column)
    for attr in block_attrs:
        if attr.startswith("@@map"):
            model.table = re.search(r'"([^"]+)"', attr).group(1)
        elif attr.startswith("@@id"):
            model.primary_key = _field_list(attr)
    if not model.primary_key:
        model.primary_key = [c.field for c in model.columns if c.is_pk]
    model.block_attrs = block_attrs
    return model


def _looks_like_enum(type_name, attributes):
    # Relations always carry @relation or are back-references (list / optional without @map).
    # Enum fields are resolved after all enums are known; treat capitalised types without
    # @relation as candidates and filter later.
    return False


def _field_list(attr):
    inner = re.search(r"\[([^\]]+)\]", attr).group(1)
    return [f.strip() for f in inner.split(",")]


# --- Migration SQL parser -------------------------------------------------------------
def parse_migrations(sql: str):
    tables = {}
    for match in re.finditer(r'CREATE TABLE "(\w+)" \((.*?)\n\);', sql, re.S):
        table, body = match.groups()
        columns = {}
        for line in body.splitlines():
            line = line.strip().rstrip(",")
            col = re.match(r'^"(\w+)"\s+(.+)$', line)
            if not col:
                continue
            name, rest = col.groups()
            not_null = "NOT NULL" in rest
            default = ""
            dm = re.search(r"DEFAULT (.+)$", rest)
            if dm:
                default = dm.group(1).strip()
            pg_type = rest.split(" NOT NULL")[0].split(" DEFAULT")[0].strip().strip('"')
            columns[name] = {"type": pg_type, "not_null": not_null, "default": default}
        pk = re.search(r'CONSTRAINT "(\w+)" PRIMARY KEY \(([^)]+)\)', body)
        tables[table] = {"columns": columns,
                         "pk_name": pk.group(1) if pk else "",
                         "pk_cols": [c.strip().strip('"') for c in pk.group(2).split(",")] if pk else []}

    indexes = []
    for m in re.finditer(r'CREATE (UNIQUE )?INDEX "(\w+)" ON "(\w+)"\(([^)]+)\);', sql):
        unique, name, table, cols = m.groups()
        indexes.append(Index(name, table, [c.strip().strip('"') for c in cols.split(",")], bool(unique)))

    fks = []
    for m in re.finditer(
            r'ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)" FOREIGN KEY \(([^)]+)\) REFERENCES "(\w+)"\(([^)]+)\) '
            r'ON DELETE (\w+(?: \w+)?) ON UPDATE (\w+(?: \w+)?);', sql):
        child, name, ccols, parent, pcols, on_delete, on_update = m.groups()
        fks.append({"name": name, "child": child, "child_cols": [c.strip().strip('"') for c in ccols.split(",")],
                    "parent": parent, "parent_cols": [c.strip().strip('"') for c in pcols.split(",")],
                    "on_delete": on_delete, "on_update": on_update})

    checks = [(m.group(2), m.group(1), " ".join(m.group(3).split()))
              for m in re.finditer(r'ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)"\s+CHECK \((.+?)\);', sql, re.S)]
    sequences = [(m.group(1), m.group(2)) for m in re.finditer(r'CREATE SEQUENCE "(\w+)" START (\d+);', sql)]
    functions = [(m.group(1), m.group(2), " ".join(m.group(3).split()))
                 for m in re.finditer(r'CREATE FUNCTION "(\w+)"\(\) RETURNS (\w+) AS \$\$(.*?)\$\$', sql, re.S)]
    triggers = [(m.group(1), m.group(3), m.group(2), m.group(4))
                for m in re.finditer(r'CREATE TRIGGER "(\w+)"\s+(BEFORE [A-Z ]+?) ON "(\w+)"\s+FOR EACH ROW '
                                     r'EXECUTE FUNCTION "(\w+)"', sql, re.S)]
    return tables, indexes, fks, checks, sequences, functions, triggers


# --- Type mapping -------------------------------------------------------------------
def prisma_to_pg(column: Column) -> str:
    attrs = column.attributes
    native = re.search(r"@db\.(\w+)(?:\(([^)]*)\))?", attrs)
    if column.is_enum:
        pg = column.prisma_type
    elif native:
        kind, args = native.group(1), native.group(2)
        pg = {"Uuid": "UUID", "VarChar": "VARCHAR", "Date": "DATE", "Timestamp": "TIMESTAMP",
              "Decimal": "DECIMAL", "Json": "JSON", "Text": "TEXT"}[kind]
        if args:
            pg = f"{pg}({args.replace(' ', '')})"
    else:
        pg = {"String": "TEXT", "Int": "INTEGER", "BigInt": "BIGINT", "Boolean": "BOOLEAN",
              "DateTime": "TIMESTAMP(3)", "Decimal": "DECIMAL(65,30)", "Json": "JSONB", "Float": "DOUBLE PRECISION",
              "Bytes": "BYTEA"}[column.prisma_type]
    if column.prisma_type == "BigInt" and "autoincrement()" in attrs:
        pg = "BIGSERIAL"
    if column.is_list:
        pg += "[]"
    return pg


def describe_default(column: Column, sql_default: str) -> str:
    attrs = column.attributes
    if "@updatedAt" in attrs:
        return "Set by the application on every update"
    m = re.search(r"@default\((.+?)\)(?:\s|$)", attrs + " ")
    if not m:
        return sql_default or ""
    value = m.group(1)
    if value == "uuid()":
        return "UUID v4 generated by the application"
    if value == "now()":
        return "CURRENT_TIMESTAMP"
    if value == "autoincrement()":
        return "Next value of the column sequence"
    if value == "[]":
        return "Empty array"
    return sql_default or value


# --- Assembly -----------------------------------------------------------------------
def load() -> PhysicalModel:
    models, enums = parse_prisma(SCHEMA_PATH.read_text())
    migration_dirs = sorted(p for p in MIGRATIONS_DIR.iterdir() if p.is_dir())
    sql = "\n".join((d / "migration.sql").read_text() for d in migration_dirs)
    tables, indexes, fks, checks, sequences, functions, triggers = parse_migrations(sql)
    enum_names = {e.name for e in enums}

    # Enum-typed fields were provisionally treated as relations; move them back.
    for model in models:
        keep = []
        for rel in model.relations:
            field_name, base, attributes, optional, is_list = rel
            if base in enum_names:
                map_match = re.search(r'@map\("([^"]+)"\)', attributes)
                column = Column(model=model.name, field=field_name,
                                name=map_match.group(1) if map_match else field_name, prisma_type=base,
                                is_list=is_list, optional=optional, attributes=attributes, is_enum=True)
                column.is_unique = bool(re.search(r"@unique\b", attributes))
                column.is_pk = bool(re.search(r"@id\b", attributes))
                model.columns.append(column)
            else:
                keep.append(rel)
        model.relations = keep
        # restore declaration order from the schema text
        order = _field_order(model.name)
        model.columns.sort(key=lambda c: order.index(c.field))

    problems = []
    index_by_table = {}
    for index in indexes:
        index_by_table.setdefault(index.table, []).append(index)

    relations = []
    for model in models:
        table = tables.get(model.table)
        if table is None:
            problems.append(f"Table {model.table} not found in migrations")
            continue
        field_to_col = {c.field: c.name for c in model.columns}
        model.primary_key = [field_to_col.get(f, f) for f in model.primary_key]
        if table["pk_cols"] != model.primary_key:
            problems.append(f"{model.table}: primary key {model.primary_key} != {table['pk_cols']}")
        for column in model.columns:
            column.pg_type = prisma_to_pg(column)
            sql_col = table["columns"].get(column.name)
            if sql_col is None:
                problems.append(f"{model.table}.{column.name} missing in migration")
                continue
            if sql_col["type"] != column.pg_type:
                problems.append(f"{model.table}.{column.name}: schema {column.pg_type} != migration {sql_col['type']}")
            if column.is_list:
                # Prisma scalar lists are nullable at database level; the application always writes an array.
                column.optional = not sql_col["not_null"]
            elif sql_col["not_null"] == column.optional:
                problems.append(f"{model.table}.{column.name}: nullability differs")
            column.default = describe_default(column, sql_col["default"])
            column.is_pk = column.name in model.primary_key
            column.indexes = [i.name for i in index_by_table.get(model.table, []) if column.name in i.columns]
        extra = set(table["columns"]) - {c.name for c in model.columns}
        if extra:
            problems.append(f"{model.table}: columns in migration but not in schema: {sorted(extra)}")

    model_by_table = {m.table: m for m in models}
    for fk in fks:
        child = model_by_table[fk["child"]]
        parent = model_by_table[fk["parent"]]
        rel_field = ""
        for field_name, base, attributes, optional, is_list in child.relations:
            fields_match = re.search(r"fields:\s*\[([^\]]+)\]", attributes)
            if base == parent.name and fields_match:
                cols = [next(c.name for c in child.columns if c.field == f.strip())
                        for f in fields_match.group(1).split(",")]
                if cols == fk["child_cols"]:
                    rel_field = field_name
        unique_child = any(i.unique and i.columns == fk["child_cols"] for i in index_by_table.get(fk["child"], []))
        relation = Relation(fk["name"], fk["child"], fk["child_cols"], fk["parent"], fk["parent_cols"],
                            fk["on_delete"], fk["on_update"], child.name, parent.name, rel_field, unique_child)
        relations.append(relation)
        for col_name in fk["child_cols"]:
            column = next(c for c in child.columns if c.name == col_name)
            column.fk = f"{fk['parent']}({', '.join(fk['parent_cols'])}) ON DELETE {fk['on_delete']}"

    for table, info in tables.items():
        if info["pk_name"]:
            indexes.append(Index(info["pk_name"], table, info["pk_cols"], True, primary=True))

    if problems:
        raise ValueError("Schema and migrations disagree:\n  " + "\n  ".join(problems))

    return PhysicalModel(models=models, enums=enums, indexes=indexes, relations=relations, checks=checks,
                         sequences=sequences, functions=functions, triggers=triggers,
                         migrations=[d.name for d in migration_dirs])


_FIELD_ORDER_CACHE = {}


def _field_order(model_name):
    if not _FIELD_ORDER_CACHE:
        current = None
        for line in SCHEMA_PATH.read_text().splitlines():
            stripped = _strip_comment(line).strip()
            m = re.match(r"^model\s+(\w+)\s*\{", stripped)
            if m:
                current = m.group(1)
                _FIELD_ORDER_CACHE[current] = []
                continue
            if stripped.startswith("}"):
                current = None
                continue
            if current and stripped and not stripped.startswith("@@"):
                _FIELD_ORDER_CACHE[current].append(stripped.split()[0])
    return _FIELD_ORDER_CACHE[model_name]


if __name__ == "__main__":
    pm = load()
    print(len(pm.models), "tables;", sum(len(m.columns) for m in pm.models), "columns;", len(pm.enums), "enums;",
          len(pm.indexes), "indexes;", len(pm.relations), "foreign keys;", len(pm.checks), "checks;",
          len(pm.sequences), "sequences;", len(pm.triggers), "triggers")
    for m in pm.models:
        print(m.section, "|", m.name, m.table, len(m.columns), m.comment)
