const container = document.querySelector('.scroll-container');
const loading = document.querySelector('.scroll-loading');

var provider = new firebase.auth.GoogleAuthProvider();
var storageRef = firebase.storage().ref();


let user_liked_images;
let current_user;

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        current_user = user;
    }
});

const getLikedImages = async () => {
    firebase.auth().onAuthStateChanged((user) => {
        user_liked_images = []
        if (user) {
            var uid = user.uid;
            var docRef = db.collection("users").doc(uid);
    
            docRef.get().then((doc) => {
                
                if (doc.exists) {
                    user_liked_images = doc.data().likes;
                }
                getNextimages()
            }).catch((error) => {
                console.log("Error getting document:", error);
            });
        } else {
            getNextimages()
        }
        console.log(user_liked_images)
    });
}



const signIn = () => {
    firebase.auth().signInWithPopup(provider).then((result) => {
        /** @type {firebase.auth.OAuthCredential} */
        var credential = result.credential;
        var token = credential.accessToken;
        var user = result.user;
        window.location.reload()
        return user;
        // ...
    }).catch((error) => {
        var errorCode = error.code;
        var errorMessage = error.message;
        var email = error.email;
        var credential = error.credential;
        alert(errorMessage)
    });
}

const likeImage = (id) => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          var uid = user.uid;
        } else {
            user = signIn();
            return
        }
        if(user_liked_images.includes(id)) return;
        updateUserLikes(user, id)
        incrementLike(id)
      });
}

const updateUserLikes = (user, image_id) => {
    const userRef = db.collection('users').doc(user.uid);

    return db.runTransaction((t) => {
    return t.get(userRef).then((doc) => {
        // doc doesn't exist; can't update
        let likedImages = [];
        if (doc.exists) {
            const prevLikedImages = doc.data().likes

            if(prevLikedImages.includes(image_id)) return;

            likedImages = doc.data().likes

        }
        likedImages.push(image_id)
        // update the users array after getting it from Firestore.
        t.set(userRef, { email: user.email, likes: likedImages }, { merge: true });
    });
    }).catch(console.log);
}

const incrementLike = (image_id) => {
    var imageRef = db.collection('generated_images').doc(image_id);

    return db.runTransaction((t) => {
        return t.get(imageRef).then((doc) => {
            if (!doc.exists) return;
            likes = doc.data().likes
            $(`label.${image_id}`).text(likes+1)
            $(`i#${image_id}`).addClass('liked')
            // update the users array after getting it from Firestore.
            t.update(imageRef, { likes: likes + 1 });
        });
        }).catch(console.log);
}

const addTask = (init_image, prompt, email, quality, type, aspect, public) => {
    $("#result").addClass('d-none')
    $("#error-message").addClass('d-none')
    $('#progress-spinner').removeClass('d-none')
    $('#progress-info').removeClass('d-none')
    $('#generate-btn-text').text('Generating...')
    $('#generate-form fieldset').prop( "disabled", true );

    db.collection("queue").add({
        prompt: prompt,
        email: email,
        quality: quality,
        type: type,
        aspect: aspect,
        public: public,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        init_image: init_image
    })
    .then((docRef) => {
        console.log(docRef.id)
        var unsubscribe = db.collection("queue")
        .orderBy("created_at")
        .onSnapshot((querySnapshot) => {
            var tasks = [];
            querySnapshot.forEach((doc) => {
                tasks.push(doc.id);
            });
            const pos = tasks.indexOf(docRef.id)
            $('#queue-info').html(`Queued at ${pos}`)

            if(pos < 0){
                unsubscribe();
                $('#queue-info').html(`Generating your artwork...`)
                let unsubscribe_doc = db.collection("generated_images").doc(docRef.id).onSnapshot((doc) => {                    
                    const data = doc.data();
                    if (doc.exists && data.image) {
                        
                        console.log(data)
                        $('#progress-spinner').addClass('d-none')
                        $('#progress-info').addClass('d-none')
                        $('#generate-btn-text').text('Generate')
                        $('#generate-form fieldset').prop( "disabled", false );

                        $("#result").removeClass('d-none')
                        $('#result img').attr("src", data.image);
                        $('#result video').attr("src", data.video);
                        unsubscribe_doc()
                    } else {
                        // doc.data() will be undefined in this case
                        console.log("No such document!");
                        //$("#error-message").removeClass('d-none')
                    }
                });
                db.collection("generated_images").doc(docRef.id).get().then((doc) => {
                    
                }).catch((error) => {
                    console.log("Error getting document:", error);
                    $("#error-message").removeClass('d-none')
                });
                
            }
        });
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
    });
}






// store last document retrieved
let latestDoc = null;

const getNextimages = async (doc) => {
    loading.classList.add('active');

    let ref;
    let data;

    if(doc == null){
         ref = db.collection('generated_images')
        .where('public', '==', true)
        .orderBy('created_at', 'desc')
        .limit(12);
        data = await ref.get();
        window.addEventListener('scroll', handleScroll);
    } else {
        ref = db.collection('generated_images')
        .where('public', '==', true)
        .orderBy('created_at', 'desc')
        .startAfter(doc)
        .limit(12);
        data = await ref.get();
    }

    // output docs
    let template = '';
    data.docs.forEach(doc => {
        const image = doc.data();
        image.user = image.user == "" ? "anonymous" : image.user.split("@")[0]
        template += `
        <div class="col-lg-4 col-md-6">
            <div class="card mb-4 box-shadow">
                <img   class="card-img-top" src="${image.image}" data-src="holder.js/100px225?theme=thumb&bg=55595c&fg=eceeef&text=Thumbnail" alt="Card image cap">
                <div class="card-body">
                    <h5 class="card-title">${image.prompt}</h5>
                    <div class="mb-3">
                        <span class="badge rounded-pill bg-secondary"><i class="fas fa-cog"></i>  ${image.quality}</span>
                        <span class="badge rounded-pill bg-secondary"><i class="fas fa-image"></i>  ${image.type}</span>
                    </div>
                    <div class="image-buttons d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i id="${doc.id}" class="fas fa-heart ${current_user != undefined && user_liked_images.includes(doc.id)? "liked" : ""}" onclick="likeImage(this.id)"></i><label class="${doc.id}">${image.likes}</label>
                            <i class="far fa-user"></i>${image.user}
                            <i class="fas fa-calendar-alt"></i>${moment(image.created_at.toDate()).fromNow()}
                            
                        </small>
                        <small class="text-muted socials">
                            <!--i class="fas fa-share-alt" onclick="shareImage('${image.image}', '${image.prompt}')"></i>-->
                            <a id="download" href="${image.image}" download><i class="fas fa-download"></i></a>
                        </small>
                    </div>
                </div>
            </div>
        </div>
        `
  })
  container.innerHTML += template;
  loading.classList.remove('active');
  
  // update latest doc
  latestDoc = data.docs[data.docs.length - 1];

  // unattach event listeners if no more docs
  if (data.empty) {
    console.log("Empty")
    loading.innerHTML = "There are no more images :("
    window.removeEventListener('scroll', handleScroll);
  }
}

async function shareImage(url, prompt) {
    const response = await fetch(url, {mode: 'no-cors'});
    const blob = await response.blob();
    const filesArray = [
      new File(
        [blob],
        'myart.jpg',
        {
          type: "image/jpeg",
          lastModified: new Date().getTime()
        }
     )
    ];
    const shareData = {
        title: 'Text2Art.com',
        text: prompt,
        files: filesArray,
    };
    if (navigator.share){
        navigator.share(shareData);
    } else {
        alert('Not supported on this browser')
    }
    
}



// load data on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
    getLikedImages();
});

// load more docs (button)
const loadMore = document.querySelector('.load-more button');

// load more books (scroll)
const handleScroll = () => {
    if(window.scrollY + window.innerHeight >= 
    document.documentElement.scrollHeight){
        getNextimages(latestDoc);
    }
}


// File Upload
// 
function ekUpload(){
    function Init() {
  
      console.log("Upload Initialised");
  
      var fileSelect    = document.getElementById('file-upload'),
          fileDrag      = document.getElementById('file-drag'),
          submitButton  = document.getElementById('submit-button');
  
      fileSelect.addEventListener('change', fileSelectHandler, false);
  
        fileDrag.addEventListener('dragover', fileDragHover, false);
        fileDrag.addEventListener('dragleave', fileDragHover, false);
        fileDrag.addEventListener('drop', fileSelectHandler, false);
    }
  
    function fileDragHover(e) {
      var fileDrag = document.getElementById('file-drag');
  
      e.stopPropagation();
      e.preventDefault();
  
      fileDrag.className = (e.type === 'dragover' ? 'hover' : 'modal-body file-upload');
    }
  
    function fileSelectHandler(e) {
      // Fetch FileList object
      var files = e.target.files || e.dataTransfer.files;
      document.getElementById('file-upload').files = files
      // Cancel event and hover styling
      fileDragHover(e);
      
  
      // Process all File objects
      for (var i = 0, f; f = files[i]; i++) {
        parseFile(f);
      }
      
    }
  
    // Output
    function output(msg) {
      // Response
      var m = document.getElementById('messages');
      m.innerHTML = msg;
    }
  
    function parseFile(file) {
  
      console.log(file.name);
      output(
        '<strong>' + encodeURI(file.name) + '</strong>'
      );
      
      // var fileType = file.type;
      // console.log(fileType);
      var imageName = file.name;
  
      var isGood = (/\.(?=gif|jpg|png|jpeg)/gi).test(imageName);
      if (isGood & file.size <= (1024*1024)) {
        document.getElementById('file-drag').classList.add("uploaded");
        document.getElementById('start').classList.add("hidden");
        document.getElementById('response').classList.remove("hidden");
        document.getElementById('notimage').classList.add("hidden");
        // Thumbnail Preview
        document.getElementById('file-image').classList.remove("hidden");
        document.getElementById('file-image').src = URL.createObjectURL(file);
      }
      else {
        document.getElementById('notimage').classList.remove("hidden");
        document.getElementById('start').classList.remove("hidden");
        document.getElementById('response').classList.add("hidden");
        document.getElementById("file-upload").value = "";
      }
    }

  
    // Check for the various File API support.
    if (window.File && window.FileList && window.FileReader) {
      Init();
    } else {
      document.getElementById('file-drag').style.display = 'none';
    }
  }
  ekUpload();


$(document).ready(function(){


    $('#generate-form').submit(function(event){
        const prompt = $('input#prompt').val()
        const email = $('input#email').val()
        const quality = $("input[type='radio'][name='quality']:checked").val();
        const type = $("input[type='radio'][name='type']:checked").val();
        const aspect = $("input[type='radio'][name='aspect']:checked").val();
        const public = $('input#public').is(':checked')
        console.log(prompt, email, quality, type, aspect)

        const files = $('#file-upload')[0].files
        if(files.length > 0){
            const init_image_file = files[0];
            storageRef.child(`init_images/image_${new Date().getTime()}`).put(init_image_file).then((snapshot) => {
                return snapshot.ref.getDownloadURL();    
            })
            .then(downloadURL => {
                console.log(downloadURL)
                addTask(downloadURL, prompt, email, quality, type, aspect, public)
             })
             .catch(error => {
                console.log(`Failed to upload file and get link - ${error}`);
             });
        } else {
            addTask('', prompt, email, quality, type, aspect, public)
        }
        
        event.preventDefault();
    })

    $('#clear-btn').click(function(event){
        $('input#prompt').val("")
        $('input#email').val("")
        $("#quality1").prop("checked", true);
        $("#type1").prop("checked", true);
        $("#aspect1").prop("checked", true);
        $("#public").prop("checked", true);

        document.getElementById('file-drag').classList.remove("uploaded");
        document.getElementById('start').classList.remove("hidden");
        document.getElementById('response').classList.add("hidden");
        document.getElementById('notimage').classList.add("hidden");
        // Thumbnail Preview
        document.getElementById('file-image').classList.add("hidden");
        document.getElementById('file-image').src = ""
        document.getElementById("file-upload").value = "";

        event.preventDefault();
    })

    $('.PillList-item input').click(function(event){
        let prompt = $('#prompt').val()
        let keyword = $(this).next().text()
        prompt = prompt.replace(` ${keyword}`, "")
        
        if($(this).prop('checked')){
            prompt = `${prompt} ${keyword}`  
        } 
        $('#prompt').val(prompt)
    })

    $('#type3').click(function(evenet){
        let prompt = $('#prompt').val()
        let keyword = 'Pixelart'
        prompt = prompt.replace(` ${keyword}`, "")
        
        if($(this).prop('checked')){
            prompt = `${prompt} ${keyword}`  
        } 
        $('#prompt').val(prompt)
    })

    var docEl = $(document),
        headerEl = $('header'),
        headerWrapEl = $('.wrapHead'),
        navEl = $('nav'),
        linkScroll = $('.scroll');
    
    docEl.on('scroll', function(){
      if ( docEl.scrollTop() > 60 ){
        headerEl.addClass('fixed-to-top');
        headerWrapEl.addClass('fixed-to-top');
        navEl.addClass('fixed-to-top');
      }
      else {
        headerEl.removeClass('fixed-to-top');
        headerWrapEl.removeClass('fixed-to-top');
        navEl.removeClass('fixed-to-top');
      }
    });
    
    linkScroll.click(function(e){
        e.preventDefault();
        $('body, html').animate({
           scrollTop: $(this.hash).offset().top
        }, 500);
     });
  });