curl -X POST "http://localhost:6399/v1/chat/completions" \
     -H "Content-Type: application/json" \
     -d '{
         "model": "deepseek-r1:14b",
         "messages": [
             {"role": "system", "content": "You are a helpful assistant."},
             {"role": "user", "content": "你好，能介绍一下你自己吗？"}
         ],
         "temperature": 0.7
     }'
