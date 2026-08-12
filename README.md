this is my first project i vide code by Gemini Chatgpt and claude then i review and combine code together 
i use docker compose there are 6 container 
- frontend (nginx)
- backend (node js)
- database (mysql)
- loki (store log)
- alloy ( select log)
- grafana ( show log filter and set alert)

frontend expose port 80 into internet 
garfana expose port 3001 into internet

to run my project 
```bash
sudo docker compose up --build
```
note: you have to stay main folder 

you can configure in .env file :
- secret jwt
- DB_PASSWORD, MYSQL_PASSWORD field both are same
- MYSQL_ROOT_PASSWORD