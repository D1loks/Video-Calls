let peer;
const socket = io('http://localhost:3000');
let userName = '';
let selectedUser;
let localStream;

const nameInput = document.querySelector('#name');
const submitNameButton = document.querySelector('#submitName');
const callButton = document.querySelector('#call');
const hangUpButton = document.querySelector('#hangUp');

// Modify load event listener
window.addEventListener('load', () => {
    const savedNames = JSON.parse(localStorage.getItem('userNames') || '{}');
    const savedName = savedNames[socket.id];
    if (savedName) {
        nameInput.value = savedName;
        userName = savedName;
        connectToSocket();
    }
});

// Modify submit button handler
submitNameButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        const savedNames = JSON.parse(localStorage.getItem('userNames') || '{}');
        savedNames[socket.id] = name;
        localStorage.setItem('userNames', JSON.stringify(savedNames));
        userName = name;
        connectToSocket();
    } else {
        alert('Please enter your name');
    }
});

// Initialize WebRTC connection
function createPeerConnection() {
    try {
        if (peer) {
            peer.close();
        }
        
        peer = new RTCPeerConnection({
            iceServers: [{
                urls: "stun:stunserver2024.stunprotocol.org"
            }]
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('iceCandidate', {
                    to: selectedUser,
                    candidate: event.candidate,
                });
            }
        };

        peer.ontrack = (event) => {
            document.querySelector('#remoteVideo').srcObject = event.streams[0];
        };

        if (localStream) {
            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
        }
    } catch (error) {
        console.error('Error creating peer connection:', error);
        throw error;
    }
}

// Modify connectToSocket function
async function connectToSocket() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        document.querySelector('#localVideo').srcObject = localStream;
        
        socket.emit('requestUserList', { 
            userName: userName
        });
    } catch (error) {
        console.error('Media error:', error);
        alert('Could not access camera/microphone');
    }
}

// Call button handler
callButton.addEventListener('click', async () => {
    if (!selectedUser || !userName) {
        alert('Please select a user to call');
        return;
    }

    try {
        createPeerConnection();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        
        socket.emit('callUser', {
            to: selectedUser,
            from: socket.id,
            fromUserName: userName,
            offer: offer
        });
    } catch (error) {
        console.error('Call error:', error);
        alert('Error making call');
    }
});

// Hang up button handler
hangUpButton.addEventListener('click', () => {
    if (selectedUser) {
        socket.emit('hangUp', {
            to: selectedUser,
            from: socket.id
        });
    }
    handleHangUp();
});

// Модифікуємо обробник incoming call
socket.on('incomingCall', async ({ from, fromUserName, offer }) => {
    try {
        const willAccept = confirm(`${fromUserName} is calling. Accept?`);
        
        if (willAccept) {
            selectedUser = from;
            createPeerConnection();
            
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            
            socket.emit('callAccepted', {
                to: from,
                from: socket.id,
                answer: answer
            });
        } else {
            socket.emit('callRejected', {
                to: from,
                from: socket.id
            });
        }
    } catch (error) {
        console.error('Error handling incoming call:', error);
        socket.emit('callRejected', {
            to: from,
            from: socket.id
        });
        alert('Error accepting call: ' + error.message);
    }
});

// Handle call accepted
socket.on('callAccepted', async ({ from, answer }) => {
    try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error completing call setup:', error);
    }
});

// Handle call rejected
socket.on('callRejected', () => {
    alert('Call was rejected');
    handleHangUp();
});

// Handle ICE candidates
socket.on('remotePeerIceCandidate', async ({ candidate }) => {
    try {
        if (peer) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
});

// Handle hang up
socket.on('hangUp', handleHangUp);

function handleHangUp() {
    if (peer) {
        peer.close();
        peer = null;
    }
    
    const remoteVideo = document.querySelector('#remoteVideo');
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }
    
    selectedUser = null;
    document.querySelectorAll('.user-item').forEach(element => {
        element.classList.remove('user-item--touched');
    });
}

// Remove tabId from socket connection indicator
socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
});

// Add debug logging for user list updates
socket.on('update-user-list', (data) => {
    console.log('Received user list update:', data);
    updateUserList(data.users);
});

// Modify updateUserList function
function updateUserList(users) {
    const usersList = document.querySelector('#usersList');
    console.log('Updating user list with:', users); // Debug log

    // Filter out current user by socket.id
    const usersToDisplay = users.filter(user => user.id !== socket.id);
    console.log('Users to display:', usersToDisplay); // Debug log

    usersList.innerHTML = '';

    if (usersToDisplay.length === 0) {
        usersList.innerHTML = '<div>No other users connected</div>';
        return;
    }

    // Show current user
    const currentUser = users.find(user => user.id === socket.id);
    if (currentUser) {
        const myNameDiv = document.createElement('div');
        myNameDiv.innerHTML = `My name: ${currentUser.name}`;
        myNameDiv.className = 'current-user';
        usersList.appendChild(myNameDiv);
    }

    // Show other users
    const divider = document.createElement('div');
    divider.className = 'divider';
    divider.innerHTML = 'Other users:';
    usersList.appendChild(divider);

    usersToDisplay.forEach(user => {
        const userItem = document.createElement('div');
        userItem.innerHTML = `${user.name}`;
        userItem.className = 'user-item';
        
        if (user.id === selectedUser) {
            userItem.classList.add('user-item--touched');
        }

        userItem.addEventListener('click', () => {
            document.querySelectorAll('.user-item').forEach(element => {
                element.classList.remove('user-item--touched');
            });
            userItem.classList.add('user-item--touched');
            selectedUser = user.id;
        });
        
        usersList.appendChild(userItem);
    });
}

// Додаємо стилі для нових елементів
const style = document.createElement('style');
style.textContent = `
    .current-user {
        font-weight: bold;
        margin-bottom: 10px;
        color: #6E2AFF;
    }
    .divider {
        margin: 10px 0;
        padding-bottom: 5px;
        border-bottom: 1px solid #6E2AFF;
    }
`;
document.head.appendChild(style);

// Модифікуємо обробник beforeunload
window.addEventListener('beforeunload', (event) => {
    try {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peer) {
            peer.close();
        }
        const savedNames = JSON.parse(localStorage.getItem('userNames') || '{}');
        delete savedNames[socket.id];
        localStorage.setItem('userNames', JSON.stringify(savedNames));
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
});
