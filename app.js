import express from "express";
import pg from "pg"
const db = new pg.Client({ // connecting to database
  user :"postgres",
  host : "localhost",
  database : "Library",
  password : "hasan",
  port : 5432

});
db.connect();

const app = express();
const port = 3000;
let books = [];
app.use(express.urlencoded({ extended: true }));  //giving the requests the body
app.use(express.static("public"));
 
// ✅ getBooks Function
async function getBooks(searchQuery = "") {
  books = []       //resets the books
  let result;
  try {
    if (searchQuery.length > 0) {  //checks for any search
      result = await db.query(
        "SELECT * FROM books WHERE title ILIKE $1",
        [`%${searchQuery}%`]
      );
    } else {
      result = await db.query("SELECT * FROM books");
    }
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// ✅ Route to handle both default and search
app.get("/", async (req, res) => {  //hits the homepage
  const searchQuery = req.query.q || "";
  books = await getBooks(searchQuery);
  let sort = req.query.sort;
  if(sort === 'rating'){
    const result = await db.query("SELECT * FROM books ORDER BY rating DESC ");
    books = result.rows;
  }
  if(sort === 'title'){
    const result = await db.query("SELECT * FROM books ORDER BY title ASC ");
    books = result.rows;
  }
  res.render("index.ejs", {
    query: searchQuery,
    books: books,
    sort: sort
  });
});

app.get('/add',(req,res)=>{
  res.render("book-form.ejs");
});

app.post('/add',async(req,res)=>{  

// }
 try{ 
   
    const { id, title, author, summary, link, rating } = req.body;
  const result = await db.query("SELECT * FROM books WHERE id = $1",[id]);
  
  if(result.rows.length >0){
         res.send(`<h1>${result}</h1>`)

}
  else{
    const image = `https://covers.openlibrary.org/b/isbn/${id}-M.jpg`;
  await db.query("INSERT INTO books (id,title,author,summary,image,link,rating) VALUES ($1,$2,$3,$4,$5,$6,$7) ",[id, title, author, summary, image, link, rating ]);
  res.redirect("/");
  }
}
  catch(err){
    console.log(err);
  }
})

app.post('/delete/:id', async(req,res)=>{
    try{
      console.log(req.params.id);
        await db.query("DELETE FROM books WHERE id = $1",[req.params.id]);
        res.redirect("/");
    }
    catch(err){
      console.log(err.stack);
    }
})




app.listen(port, ()=>{
  console.log(`BookGasm running at http://localhost:${port}`);
})