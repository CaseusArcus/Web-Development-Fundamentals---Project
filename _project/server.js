//load packages: express, handlebars, bcrypt
const sqlite3 = require('sqlite3')
const express = require('express');
const { engine } = require('express-handlebars');
//sessions in express
const session = require('express-session');
//store sessions in sql database
const connectSqlite3 = require('connect-sqlite3');
const bcrypt = require('bcrypt');
//salt round for bcrypt algorithm
const saltRound = 12;

//initialize the express app
const app = express();
app.use(express.static('public'));
//middleware to parse form data (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));
//initialize the engine to be handlebars
app.engine('handlebars', engine({
    defaultLayout: 'main'
}));

//set handlebars as the view engine
app.set('view engine', 'handlebars');
//define the views directory to be ./views
app.set('views', './views');

//define port to listen on
const PORT = 4442;

app.listen(PORT, () => {
    console.log(`server is running on http://localhost:${PORT}`);
});

//Global variables
const adminName = "Kev123"
//const adminPassword = "Kev123" (original password)
//hashed password
const adminPassword = "$2b$12$$2b$12$0CDPeyxSnondJf6PCaajBO9wrt3bTF9yiM87W2P.X7hUkZPhNuXNi"

//function to check if user is admin
function isAdmin(req, res, next) {
    console.log('Checking if user is admin', req.session);
    if (req.session && req.session.isLoggedIn && req.session.isAdmin) {
        return next();
    }
    res.redirect('/home');  // Redirect to home if not admin
}

/* 
//Hash password once and replace original password
bcrypt.hash(adminPassword, saltRound, function(err, hash) {
    if(err) {
        console.log("Error encrypting the password.", err)
    } else {
        console.log("Hashed passwprd: ", hash)
    }
}); 
*/

//--------SESSIONS---------//
//store sessions in database
const SQLiteStore = connectSqlite3(session)
//define session
app.use(session({
    store: new SQLiteStore({ db: "session-db.db" }),
    "saveUninitialized": false,
    "resave": false,
    "secret": "This123Is@Another#456GreatSecret678%Sentence"
}));
//save variables in session
app.use(function (req, res, next) {
    console.log("session passed to response locals");
    res.locals.session = req.session;
    next();
});

//--------DATABASE---------//
const dbFile = 'project-data.sqlite3.db';
db = new sqlite3.Database(dbFile);

//--------ROUTES---------//
//create default route (home)
app.get('/', function (req, res) {
    const model = {
        isLoggedIn: req.session.isLoggedIn,
        name: req.session.name,
        isAdmin: req.session.isAdmin
    }
    console.log("home model: " + JSON.stringify(model));
    res.render('home.handlebars', model);
});

//create contact route
app.get('/contact', (req, res) => {
    res.render('contact');
});

//create about route
app.get('/about', (req, res) => {
    res.render('about');
});

//create products route
app.get('/products', (req, res) => {
    //view products from database
    db.all('SELECT * FROM product', (err, rows) => {
        if (err) {
            //error fetching products
            res.status(500).send("error fetching products");
        } else {
            //displays products from db
            const model = { products: rows, isLoggedIn: req.session.isLoggedIn };
            res.render('products.handlebars', model);
        }
    });
});

//create registration route (create new account)
app.get('/register', (req, res) => {
    res.render('register');

});

//create login route
app.get('/login', (req, res) => {
    res.render('login');
});

//create logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Error while destorying the session.", err);
        } else {
            console.log("logged out");
            res.redirect('/');
        }
    })
});

//----------ADMIN ROUTES------------//
//route to render adminUsers page
app.get('/adminUsers', (req, res) => {
    if (req.session.isAdmin) { // Ensure only admins can access
        db.all('SELECT * FROM user', (err, rows) => {
            if (err) {
                res.status(500).send("Error fetching users")
            } else {
                const model = { users: rows, isLoggedIn: req.session.isLoggedIn };
                res.render('adminUsers.handlebars', model);
            }
        });
    } else {
        res.redirect('/'); // Redirect non-admins to the home page
    }
});

//route to render adminProducts page
app.get('/adminProducts', (req, res) => {
    if (req.session.isAdmin) { // Ensure only admins can access
        db.all('SELECT * FROM product', (err, rows) => {
            if (err) {
                res.status(500).send("Error fetching products");
            } else {
                const model = { products: rows, isLoggedIn: req.session.isLoggedIn };
                res.render('adminProducts.handlebars', model);
            }
        });
    } else {
        res.redirect('/'); // Redirect non-admins to the home page
    }
});

//edit user route
app.get('/editUser/:userID', (req, res) => {
    const userID = req.params.userID;
    db.get('SELECT * FROM user WHERE userID = ?', [userID], (err, row) => {
        if (err || !row) {
            res.status(404).send("User not found");
        } else {
            res.render('editUser.handlebars', { user: row });
        }
    });
});

//delete user route
app.get('/deleteUser/:userID', (req, res) => {
    const userID = req.params.userID;

    db.run('DELETE FROM user WHERE userID = ?', [userID], function(err) {
        if (err) {
            res.status(500).send("Error deleting user");
        } else {
            res.redirect('/adminUsers'); // Redirect to the user management page
        }
    });
});

//edit product route
app.get('/editProduct/:productID', (req, res) => {
    const productID = req.params.productID;
    db.get('SELECT * FROM product WHERE productID = ?', [productID], (err, row) => {
        if (err || !row) {
            res.status(404).send("Product not found");
        } else {
            res.render('editProduct.handlebars', { product: row });
        }
    });
});

//delete product route
app.get('/deleteProduct/:productID', (req, res) => {
    const productID = req.params.productID;

    db.run('DELETE FROM product WHERE productID = ?', [productID], function(err) {
        if (err) {
            res.status(500).send("Error deleting product");
        } else {
            res.redirect('/adminProducts'); // Redirect to the products management page
        }
    });
});

//create product details route
app.get('/product/:id', (req, res) => {
    const productID = req.params.id;
    //get product details from DB
    db.get(`SELECT * FROM product WHERE productID = ?`, [productID], (err, row) => {
        if(err)
            return res.status(500).send("Error retrieving product details");
        if(!row)
            return res.status(500).send("Product not found");
        //render product description with the new data
        res.render('productDescription', row);
    });
});

/*------------POST REQUESTS------------*/
//request create account
app.post('/newUser', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const fName = req.body.fName;
    const lName = req.body.lName;
    const mail = req.body.mail;

    console.log(`Adding user: ${username}`);
    //check if fields contain text
    if (!username || !password || !fName || !lName || !mail) {
        //build model
        const model = { error: "All fields must be filled in", message: "" };
        console.log("unfilled fields error");
        //send response
        return res.status(400).render('register.handlebars', model);
    }
    //check if username or mail already exists in the db
    db.get(`SELECT * FROM user WHERE username = ? OR mail = ?`, [username, mail], (err, row) => {
        if (err) {
            //build model for database error
            const model = { error: "Database error", message: "" };
            console.log("database error");
            //send response
            res.status(400).render('register.handlebars', model)
        } else if (row) {
            //build model for username or mail already exists
            const model = { error: "Username or e-mail already exists", message: "" };
            console.log("mail/username already taken error");
            //send response
            res.status(400).render('register.handlebars', model);
        }
        //if username och mail are unique, hash password and store in database
        bcrypt.hash(password, saltRound, (err, hash) => {
            if (err) {
                //model for password-hashing error
                const model = { error: "error when hashing password", message: "" };
                console.log("hashing password error");
                //send response
                res.status(400).render('register.handlebars', model);
            } else {
                console.log("password hashed");
                //insert into db, including hashed password
                db.run(`INSERT INTO user(username, password, fName, lName, mail) 
                    VALUES (?, ?, ?, ?, ?)`, [username, hash, fName, lName, mail], (err) => {
                    if (err) {
                        //build a model for account reation fail
                        const model = { error: "Error when creating account", message: "" };
                        console.log("creating account error");
                        res.status(400).render('register.handlebars', model);
                    } else {
                        //build model for success
                        const model = { error: "", message: "Account created!" };
                        console.log("User added");
                        res.redirect('/login');
                    }
                });
            }
        });
    });
});

//request login
app.post('/login', (req, res) => {
    const username = req.body.username.trim();
    const password = req.body.password;
    //check if fields contain text
    if (!username || !password) {
        //build a model
        const model = { error: "Username and password are required.", message: "" };
        //send response
        return res.status(400).render('login.handlebars', model);
    }
    //check if username exists in the database
    db.get(`SELECT * FROM user WHERE username = ? COLLATE NOCASE`, [username], (err, row) => {
        if (err) {
            //model for database error
            const model = { error: "Database error.", message: "" };
            console.log("error reading username from database");
            //send response
            return res.status(400).render('login.handlebars', model);
        }
        if (!row) {
            //model for username not found in database
            const model = { error: `${username} is not a registered user.`, message: "" };
            console.log(`${username} not found in database`);
            //send response
            return res.status(400).render('login.handlebars', model)
        }
        //compare password in textfield to password in db
        bcrypt.compare(password, row.password, (err, result) => {
            if (err) {
                //model for failing to compare passwords
                const model = { error: "Database error.", message: "" };
                console.log("comparing password to db error");
                //response
                return res.status(400).render('login.handlebars', model);
            }
            if (result) {
                console.log("passwords match");
                //save information into session
                req.session.isLoggedIn = true;
                req.session.isAdmin = row.isAdmin;
                req.session.name = username;

                console.log("session information: " + JSON.stringify(req.session));
                //redirect after successfull login
                return res.redirect('/');
            } else {
                //model for incorrect password
                const model = { error: "Wrong username or password!", message: "" };
                console.log("password login error");
                //response
                return res.status(400).render('login.handlebars', model);
            }
        });
    });
});

//post update product
app.post('/updateProduct/:productID', (req, res) => {
    const productID = req.params.productID;
    const { pName, desc, color, category, quantity, price, imageURL } = req.body;  // Get form values

    // Update the product in the database
    db.run(
        `UPDATE product SET pName = ?, desc = ?, color = ?, category = ?, quantity = ?, price = ?, imageURL = ? WHERE productID = ?`,
        [pName, desc, color, category, quantity, price, imageURL, productID],
        function (err) {
            if (err) {
                return res.status(500).send("Error updating product");
            }
            res.redirect('/adminProducts');  // Redirect to the products page after updating
        }
    );
});

//deleting products
app.post('/admin/deleteProduct', isAdmin, (req, res) => {
    const { productId } = req.body;

    db.run(`DELETE FROM product WHERE productId = ?`, [productId], (err) => {
        if (err) {
            //deleting error
            console.log("Error deleting product:", err);
            return res.status(400).render('admin.handlebars', { error: "Error deleting product" });
        }
        //deleting success
        console.log("Product deleted successfully!");
        res.render('admin.handlebars', { message: "Product deleted successfully!" });
    });
});

//post update user route
app.post('/updateUser/:userID', (req, res) => {
    const userID = req.params.userID;
    const { fName, lName, mail, username, isAdmin } = req.body;  // Get the form values

    // Update the user in the database
    db.run(
        `UPDATE user SET fName = ?, lName = ?, mail = ?, username = ?, isAdmin = ? WHERE userID = ?`,
        [fName, lName, mail, username, isAdmin ? 1 : 0, userID],  // Set isAdmin to 1 or 0 based on checkbox
        function (err) {
            if (err) {
                return res.status(500).send("Error updating user");
            }
            res.redirect('/adminUsers');  // Redirect to the users page after updating
        }
    );
});

/*
// CREATED TABLES
db.run (`INSERT INTO product( pName, desc, color, category, quantity, price, imageURL) 
    VALUES 
    ('Bowling Ball', 'Our classic luxorious bowling ball in the color red. How magnificent of a ball it is!', 'Red', 'Sport', 20, 89.99, '_bowlingBallRed'),
    ('Contact Juggling Ball', 'Into contact juggling? These are specially made for contact juggling!', 'Clear', 'Entertainment', 45, 59.99, '_contactJuggleBall.jpg'),
    ('Disco Ball', 'Woooo, party all night long! The perfect ball for the special occations!', 'Silver', 'Entertainment', 5000, 699.99, '_discoBall.jpeg'),
    ('Golf Ball', 'A golfer who likes blue? This ball is for you.', 'Blue', 'Sport', '30', 12.99, '_golfBallBlue.jpeg'),
    ('Golf Ball', 'Serious about golfing? This purple golf ball is the perfect way to add some swag into your favourite sport!', 'Purple', 'Sport', '60', '12.99', '_golfBallPurple.jpeg'),
    ('Tennis Ball', 'These balls are the ultimate pick for dogs and tennis enthusiasts!', 'Yellow', 'Sport', '50', '35.99', '_tennisBall.jpeg'),
    ('Bowling Ball', 'Hard and durable. Just as a bowling ball should be!', 'Grey', 'Sport', '300', '49.99', '_bowlingBallGrey.jpeg'),
    ('Golf Ball', 'Lean, mean and always in the green! This ball is perfect for the winners!', 'Green', 'Sport', '34', '54.99', '_golfBallGreen.jpeg')`, (err) => {
        if(err)
            console.log("error inserting products " + err);
        else
            console.log("insert products success");
    }); */

//create tables
/*db.run (`CREATE TABLE user(
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    mail VARCHAR(255) UNIQUE NOT NULL,
    fName VARCHAR(255) NOT NULL,
    lName VARCHAR(255) NOT NULL,
    isAdmin BOOLEAN deafult (0),
    userID INTEGER PRIMARY KEY AUTOINCREMENT
); */

/*db.run (` CREATE TABLE product(
   pName VARCHAR(255),
   desc VARCHAR(255),
   color VARCHAR(255),
   category VARCHAR(255),
   quantity INTEGER NOT NULL,
   price FLOAT NOT NULL,
   imageURL VARCHAR(255),
   productID INTEGER PRIMARY KEY AUTOINCREMENT
);`, (err) => {
   if(err)
       console.log("error creating tables", err);
   else
       console.log("tables created");
});*/

/* db.run (`CREATE TABLE purchase( 
 orderID INTEGER PRIMARY KEY AUTOINCREMENT,
 orderDate DATE NOT NULL,
 quantity INTEGER NOT NULL,
 totalPrice INTEGER NOT NULL,
 productID INTEGER REFERENCES product(productID),
 userID INTEGER REFERENCES user(userID)
 ); `, (err) => {
     if(err)
         console.log("error creating tables", err);
     else
         console.log("tables created");
 }); 

 db.run(`ALTER TABLE user ADD COLUMN isAdmin INTEGER DEFAULT 0`, (err) => {
     if(err) {
         console.log("error altering user (add isAdmin column)");
     } else {
         console.log("isAdmin was added to table user")
     }
 }); 
 */