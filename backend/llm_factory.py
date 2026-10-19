import os 
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

#load .env file API Keys and then use them in code
#load_dotenv()

def llm_factory(pdf_text = "" , user_qn = ""):
    pdf_text = "hello gemini help me solve my question"
    user_qn = "diff between python & c++"
    try:
        # Gemini LLM ka code run karo
        return gemini_model(pdf_text, user_qn)

    except Exception as e:
        print("my new error")
        print(e)
        return None


def gemini_model(pdf_text = "" ,user_qn = "" ):
    api_key = os.getenv("GOOGLE_API_KEY")
    
    # model code 
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.5-flash",
        google_api_key=api_key
    )

    # Prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful AI assistant"),
        ("human", "{question}")
    ])

    # Chain create
    chain = prompt | llm

    question = pdf_text + user_qn 

    response = chain.invoke({ "question": question})

    output = response.content[0]["text"]
    
    print(output)

    return output 



