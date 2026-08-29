const url = 'https://qyaxgthiyxezlugwwmhf.supabase.co/rest/v1/lesson_plans?select=*';
fetch(url, {
  headers: {
    'apikey': 'sb_publishable_DkQwJ8J6f9bfMBVvuEmNxA_Zm3DXsmn',
    'Authorization': 'Bearer sb_publishable_DkQwJ8J6f9bfMBVvuEmNxA_Zm3DXsmn'
  }
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
