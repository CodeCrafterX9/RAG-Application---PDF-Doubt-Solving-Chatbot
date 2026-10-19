from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from read_pdf import read_pdf
from upload_in_db import count_pdf


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(
    "main_app",
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route("/")
def home_page():
    return render_template("index.html")


@app.route("/documents", methods=["POST"])
def upload_documents():
    print("🔥 /documents REQUEST RECEIVED", flush=True)

    files = request.files.getlist("files")

    print("🔥 FILES:", files, flush=True)

    for file in files:
        print("🔥 FILE NAME:", file.filename, flush=True)

    uploaded = []

    file_id = count_pdf()

    for file in files:
        if not file.filename:
            continue

        if not file.filename.lower().endswith(".pdf"):
            continue

        print("🔥 SAVING FILE:", file.filename, flush=True)

        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        print("🔥 FILE SAVED:", filepath, flush=True)
        print("🔥 CALLING read_pdf()", flush=True)

        file_id +=1 
        uploaded_file = read_pdf(filepath,file_id,file.filename)

        print("🔥 read_pdf DONE", flush=True)

        uploaded.append({
            "id": file.filename,
            "filename": file.filename,
            "pages": uploaded_file["page_count"] ,
            "status": "ready"
        })

    print("🔥 FINAL RESPONSE:", uploaded, flush=True)

    return jsonify(uploaded)


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
