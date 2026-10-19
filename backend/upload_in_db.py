import duckdb
import os 
from datetime import datetime
import numpy , pandas
import hashlib

DB_PATH = "database/rag_application.db"

def create_db():
    #create folder if not exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    conn = duckdb.connect(DB_PATH)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            file_id VARCHAR PRIMARY KEY,
            file_name VARCHAR,
            file_path VARCHAR,
            page_count INTEGER,
            doc_text TEXT,
            created_at TIMESTAMP  , 
            user_id VARCHAR
        )
        """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS document_pages (
            id VARCHAR PRIMARY KEY,
            document_id VARCHAR,
            page_number INTEGER,
            text TEXT
        )
    """)

    return conn

def read_db():
    conn = duckdb.connect(DB_PATH)    
    tables =conn.execute("SHOW TABLES").fetchall()
    menu ={}
    i=0
    print("List of Tables: ")
    for table in tables :
        i+=1
        print("Table Name:  ",table[0])
        menu[i] = table[0]
    
    print("Do you want to know data for table")
    for i in menu:
        print(f"Press {i} to open {menu[i]}")
    
    entry = int(input("Enter your input :"))
    try : 
        show_table_data(menu[entry])
    except:
        print("Try Again")
        
def show_table_data(table_name):
    conn = duckdb.connect(DB_PATH)
    query = f"SELECT * from {table_name} limit 5"
    result = conn.execute(query).fetchall()
    print(result)
    return 

def insert_data(table_name,data):
    conn = duckdb.connect(DB_PATH)
    columns = ", ".join(data.keys())
    placeholders = ", ".join(["?"] * len(data))

    query = f"""
            INSERT INTO {table_name}
            ({columns})
            VALUES ({placeholders})
        """

    values = tuple(data.values())

    #print(query , values)

    conn.execute(query, values)

    return 

def generate_id(member_number):
    return hashlib.sha256(
        str(member_number).encode()
    ).hexdigest()

def count_pdf():
    conn = duckdb.connect(DB_PATH)
    return conn.execute("SELECT COUNT(*) from documents").fetchone()[0]


# conn = create_db()

# read_db()
# show_table_data('documents')
# data = {'id':'1234'}
# data['file_name']= 'f'
# data['file_path']= '123'
# data['page_count']= '1234'
# data['doc_text']='text'
# data['created_at'] = datetime.now()
# data['user_id'] = 123

# insert_data('documents',data)

# read_db()