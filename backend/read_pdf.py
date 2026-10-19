import os
import pymupdf
import pytesseract
from PIL import Image
import io
from upload_in_db import *

def data_format(table_name, input):
    if table_name == 'documents':
        #input = {file_id,file_name,file_path,page_count,first_timestamp,user_id constant }
        file_id = generate_id(input['file_id'])
        output = {'file_id':file_id , 
                'file_name':input['file_name'] ,
                'file_path':input['file_path'] ,
                'page_count':input['page_count'] ,
                'created_at':input['first_timestamp'],
                'user_id':input['user_id']
                }
        return output
    elif table_name == 'document_pages':
        #input = {file_id,page_number,text }
        document_id = generate_id(input['file_id'])
        id = document_id+"_"+str(input['page_number'])

        output = {
           'id':id,
           'document_id':document_id ,
           'page_number':input['page_number'],
           'text':input['text']
        }

        return output 

def read_pdf(pdf,file_id,filename):

    doc_text = ""
    page_count = 0

    # Folder check/create
    image_folder = "temp_images"
    os.makedirs(image_folder, exist_ok=True)

    doc = pymupdf.open(pdf)

    #current timestamp    
    current_timestamp = int(datetime.now().timestamp())
    current_timestamp = datetime.fromtimestamp(current_timestamp)


    # PDF pages ko image mein convert karo
    for i, page in enumerate(doc):

        pix = page.get_pixmap(
            matrix=pymupdf.Matrix(2, 2)
        )

        # Image banate hi isi folder mein save karo
        image_path = os.path.join(
            image_folder,
            f"page_{i + 1}.png"
        )

        pix.save(image_path)

        # Ab saved image ko PIL se open karo
        img = Image.open(image_path)

        # OCR
        text = pytesseract.image_to_string(img)

        print(f"\n========== PAGE {i + 1} ==========")

        doc_text += text
        page_count += 1

        #input = {file_id,page_number,text }
        page_data = {
            'file_id':file_id , 
            'page_number':page_count ,
            'text':text
        }

        print(f"INPUTTING PAGE {page_count} DATA IN DB")
        # print("query input document_pages")
        # print(data_format('document_pages', page_data))

        #inserting data into db
        insert_data("document_pages",data_format('document_pages', page_data))  

        # Is page ki image OCR ke baad turant delete
        img.close()
        os.remove(image_path)

    doc.close()

#input = {file_id,file_name,file_path,page_count,first_timestamp,user_id constant }

    file_data = {
        'file_id':file_id , 
        'file_name':filename , 
        'file_path':pdf,
        'page_count':page_count , 
        'user_id' : '12Prachi' ,
        'first_timestamp' : current_timestamp
    }

    #print("query input documents")
    #print(data_format('documents', file_data))

    #inserting data into db
    insert_data("documents",data_format('documents', file_data))

    # Folder empty hai to folder bhi delete kar do
    if os.path.exists(image_folder) and not os.listdir(image_folder):
        os.rmdir(image_folder)

    return {
        "doc_text": doc_text,
        "page_count": page_count
    }
