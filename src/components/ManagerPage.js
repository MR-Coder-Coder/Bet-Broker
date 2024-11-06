import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
// import { handleTransactionResult, generateAgentJournals, generateAdditionalJournals } from './transactionLogic'; // Import the business logic
import calculateAndStorePositions from './calculatePositions'; // Import the utility function
import ResultsModal from './ResultsModal'; // Import the ResultsModal component
import BetSlipModal from './BetSlipModal'; // Adjust the path based on your folder structure


const ManagerPage = () => {
  const navigate = useNavigate();
  
  // State Hooks
  const [transactions, setTransactions] = useState([]);
  const [messages, setMessages] = useState({});
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [betLimit, setBetLimit] = useState('');
  const [seekPrice, setSeekPrice] = useState('');
  const [clientAmount, setClientAmount] = useState('');
  const [clientPrice, setClientPrice] = useState('');
  const [timer, setTimer] = useState('');
  const [agentMessage, setAgentMessage] = useState('');
  const [showMessagesModal, setShowMessagesModal] = useState(false); // To toggle the modal
  const [transactionMessages, setTransactionMessages] = useState([]); // To store fetched messages
  const [selectedTransactionId, setSelectedTransactionId] = useState(null); // To store the transaction ID for the results modal
  const [timers, setTimers] = useState({}); // New state to store timers
  // Inside ManagerPage component

  const [showBetSlipModal, setShowBetSlipModal] = useState(false);
  const [selectedBetSlipTransaction, setSelectedBetSlipTransaction] = useState(null);

  // Add for Sound  
  const soundRef = useRef(new Audio('/notify.mp4'));
  const previousTransactionsRef = useRef([]); // useRef instead of useState

  // Adding the Flash Effect to Updated Rows
  const [updatedTransactionIds, setUpdatedTransactionIds] = useState([]);


  // Fetching Transactions, Messages, and Agents Data
  useEffect(() => {
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('status', 'in', ['Open', 'In-Progress', 'Closed-UnSettled', 'Closed-Settled', 'Declined']));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allTransactions = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Sort transactions by systemdate (string) as Date
      const sortedTransactions = allTransactions.sort((a, b) => {
        const dateA = new Date(a.systemdate);
        const dateB = new Date(b.systemdate);
        return dateB - dateA; // Newest date first
      });

      // Detect changes by comparing to previous transactions
      const changedIds = sortedTransactions
        .filter((newTransaction) => {
          const prevTransaction = previousTransactionsRef.current.find(t => t.id === newTransaction.id);
          return prevTransaction && JSON.stringify(prevTransaction) !== JSON.stringify(newTransaction);
        })
        .map(t => t.id);

      setUpdatedTransactionIds(changedIds);
      setTransactions(sortedTransactions);

      // Play sound if there are changes
      if (changedIds.length > 0) {
        soundRef.current.play();
      }

      // Update previousTransactionsRef with the latest transactions
      previousTransactionsRef.current = sortedTransactions;
    });

    // Set up a real-time listener for messages_agents
    const messagesQuery = collection(db, 'messages_agents');
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const newMessages = {};
      const newTimers = {}; // Temporary storage for timers

      querySnapshot.forEach((doc) => {
        const message = doc.data();
        const transactionId = message.transactionId;

        // Only consider messages of type 'timer'
        if (message.type === 'timer' && message.timer) {
          if (!newTimers[transactionId]) {
            newTimers[transactionId] = [];
          }
          // Store each timer message with its timestamp for sorting
          newTimers[transactionId].push({
            timestamp: message.timestamp.toMillis(),
            timer: parseInt(message.timer, 10),
          });
        }

        // Initialize if transaction ID not yet tracked
        if (!newMessages[transactionId]) {
          newMessages[transactionId] = { messageCount: 0, amountTotal: 0, blendedPriceNumerator: 0 };
        }

        newMessages[transactionId].messageCount += 1;

        // Sum amounts if the amount field exists
        if (message.amount) {
          const amount = parseFloat(message.amount);
          newMessages[transactionId].amountTotal += amount;

          // Calculate blended price numerator (amount * price)
          if (message.price) {
            newMessages[transactionId].blendedPriceNumerator += amount * parseFloat(message.price);
          }
        }
      });

      // Calculate blended price for each transaction
      Object.keys(newMessages).forEach((transactionId) => {
        const data = newMessages[transactionId];
        data.blendedPrice = data.amountTotal > 0 ? data.blendedPriceNumerator / data.amountTotal : 0;
      });

      // Calculate the endTime based on the latest timer message
      Object.keys(newTimers).forEach((transactionId) => {
        const timers = newTimers[transactionId];
        if (timers.length > 0) {
          // Sort by timestamp and get the latest timer message
          timers.sort((a, b) => b.timestamp - a.timestamp);
          const { timestamp, timer } = timers[0];
          const endTime = timestamp + timer * 1000;

          // Set timer data for this transaction
          newMessages[transactionId] = {
            ...newMessages[transactionId],
            initialTime: timer,
            endTime: endTime,
          };
        }
      });

      setMessages(newMessages);
      setTimers(newTimers); // Set timers for countdown
    });

    // Set up a real-time listener for agents collection
    const agentsRef = collection(db, 'agents');
    const unsubscribeAgents = onSnapshot(agentsRef, (querySnapshot) => {
      const agentList = [];
      querySnapshot.forEach((doc) => {
        agentList.push({ id: doc.id, ...doc.data() });
      });
      setAgents(agentList);
    });

    // Cleanup function to unsubscribe from listeners when the component unmounts
    return () => {
      unsubscribe();
      unsubscribeMessages();
      unsubscribeAgents();
    };
  }, []);

  // In the useEffect interval for countdown logic:
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        const updatedTimers = { ...prevTimers };
        Object.keys(updatedTimers).forEach((transactionId) => {
          const currentTime = Date.now();
          const endTime = messages[transactionId]?.endTime;

          if (endTime) {
            const remainingTime = Math.max(Math.floor((endTime - currentTime) / 1000), 0);

            if (remainingTime === 0) {
              updatedTimers[transactionId].display = 'Finished';
            } else {
              updatedTimers[transactionId].display = `${remainingTime}s`;
            }
          } else {
            updatedTimers[transactionId].display = 'Not Set';
          }
        });
        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [messages]);
  

  const handleShowBetSlip = (transaction) => {
    setSelectedBetSlipTransaction(transaction);
    setShowBetSlipModal(true);
  };
  
  const handleCloseBetSlipModal = () => {
    setShowBetSlipModal(false);
    setSelectedBetSlipTransaction(null);
  };

  const handleViewMessages = (transaction) => {
    const messagesQuery = query(
      collection(db, 'messages_agents'),
      where('transactionId', '==', transaction.id)
    );
  
    onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  
      // Sort messages by timestamp (ascending order)
      const sortedMessages = fetchedMessages.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  
      setTransactionMessages(sortedMessages); // Store the fetched messages
      setShowMessagesModal(true); // Open the modal
    });
  };
  
  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/'); // Navigate to login page after logging out
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Handle Decline Transaction
  const handleDecline = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDeclineModal(true);
  };

  // Handle Assign Transaction
  const handleAssign = async (transaction) => {
    setSelectedTransaction(transaction);
    setBetLimit(transaction.betlimit || '');
    setSeekPrice(transaction.seekprice || '');
    setAgentMessage('');
    setShowAssignModal(true);
  
    const agentsRef = collection(db, 'agents');
    const agentList = [];
  
    // Fetch agents from `agents` collection
    const agentsSnapshot = await getDocs(agentsRef);
    for (const agentDoc of agentsSnapshot.docs) {
      const agentData = agentDoc.data();
      const agentId = agentDoc.id;
  
      // If `agent_users` exists, use the first user ID (assuming only one user per agent)
      if (agentData.agent_users && agentData.agent_users.length > 0) {
        const userId = agentData.agent_users[0];
  
        // Fetch user details from `users` collection using the user ID
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
  
        if (userDoc.exists) {
          const userData = userDoc.data();
          agentList.push({
            id: agentId,
            name: agentData.name,
            isOnline: userData.isOnline || false,
            lastActive: userData.lastActive?.toMillis() || null,
          });
        }
      }
    }
  
    setAgents(agentList); // Set the agent list in the state
  };

  // Handle Close Transaction
  const handleClose = (transaction) => {
    setSelectedTransaction(transaction);
    setBetLimit(transaction.betlimit || '');
    setSeekPrice(transaction.requestprice || '');
    setClientAmount(messages[transaction.id]?.amountTotal || '');
    setClientPrice(transaction.requestprice || '');
    setShowCloseModal(true);
  };

  // Handle Timer Transaction
  const handleTimer = (transaction) => {
    setSelectedTransaction(transaction);
    setTimer('30');
    setShowTimerModal(true);
  };

  // Handle Decline Submit
  const handleDeclineSubmit = async () => {
    if (selectedTransaction) {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        status: 'Declined',
      });

      await addDoc(collection(db, 'messages_client'), {
        transactionId: selectedTransaction.id,
        timestamp: new Date(),
        message: 'Sorry, Cannot fulfill that request',
        type: 'decline',
      });

      setShowDeclineModal(false);
      setSelectedTransaction(null);
    }
  };

  // Handle Assign Submit
  const handleAssignSubmit = async () => {
    if (selectedTransaction) {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        status: 'In-Progress',
        AssignedAgents: selectedAgents,
        seekprice: seekPrice, // Update the seekprice in the transaction
      });

      for (const agentId of selectedAgents) {
        await addDoc(collection(db, 'messages_agents'), {
          transactionId: selectedTransaction.id,
          timestamp: new Date(),
          agentId: agentId,
          betlimit: betLimit,
          seekprice: seekPrice,
          message: agentMessage,
          type: 'assign',
        });
      }

      setShowAssignModal(false);
      setSelectedTransaction(null);
      setSelectedAgents([]);
    }
  };

  // Handle Close Submit
  const handleCloseSubmit = async () => {
    if (selectedTransaction) {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        status: 'Closed-UnSettled',
      });

      for (const agentId of selectedTransaction.AssignedAgents || []) {
        await addDoc(collection(db, 'messages_agents'), {
          transactionId: selectedTransaction.id,
          timestamp: new Date(),
          agentId: agentId,
          message: 'Manager has closed transaction',
          type: 'close',
        });
      }
      // Convert clientAmount and clientPrice to numbers
      const clientAmountNumber = parseFloat(clientAmount) || 0; // Default to 0 if conversion fails
      const clientPriceNumber = parseFloat(clientPrice) || 0;

      await addDoc(collection(db, 'messages_client'), {
        transactionId: selectedTransaction.id,
        timestamp: new Date(),
        type: 'client_fill',
        client_amount: clientAmountNumber,  // Use the number here
        client_price: clientPriceNumber,    // Use the number here
      });

      setShowCloseModal(false);
      setSelectedTransaction(null);
    }
  };

  // Handle Timer Submit
  const handleTimerSubmit = async () => {
    if (selectedTransaction) {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        status: 'In-Progress',
      });

      for (const agentId of selectedTransaction.AssignedAgents || []) {
        await addDoc(collection(db, 'messages_agents'), {
          transactionId: selectedTransaction.id,
          timestamp: new Date(),
          agentId: agentId,
          timer: timer,
          message: 'Manager has set close timer on transaction',
          type: 'timer',
        });
      }

      setShowTimerModal(false);
      setSelectedTransaction(null);
    }
  };

  // Function to handle showing the results modal
  const handleShowResults = (transaction) => {
    setSelectedTransactionId(transaction.id); // Set the ID of the transaction to display results
  };

  // Function to handle closing the results modal
  const handleCloseResults = () => {
    setSelectedTransactionId(null); // Clear the transaction ID to close the modal
  };  

  const formatDate = (timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  };
  
  const renderMessage = (message) => {
    let content = null;
    let containerClass = 'p-2 bg-gray-700 rounded'; // Default container style
  
    switch (message.type) {
      case 'assign':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Seek Price: ${message.seekprice || 0}, Bet Limit: ${message.betlimit || ''}, Agent: ${message.agentId || ''}`}</div>
          </>
        );
        break;
  
      case 'agent_finish':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Agent: ${message.agentName || ''}, Message: ${message.message || ''}`}</div>
          </>
        );
        containerClass += ' ml-4 bg-green-700'; // Indent and color change for agent_finish
        break;
  
      case 'agent_fill':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Price: ${message.price || 0}, Amount: ${message.amount || 0}, Notes: ${message.notes || ''}, Agent: ${message.agentName || ''}`}</div>
          </>
        );
        containerClass += ' ml-4 bg-blue-700'; // Indent and color change for agent_fill
        break;

      case 'agent_note_with_image':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Notes: ${message.notes || ''}`}</div>
            {message.imageUrl && (
              <a
                href={message.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center mt-2 text-blue-500 hover:text-blue-700"
              >
                🖼️ View Image
              </a>
            )}
          </>
        );
        containerClass += ' bg-purple-700';
        break;
          
      case 'close':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Message: ${message.message || ''}`}</div>
          </>
        );
        break;
  
      default:
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Amount: ${message.amount || 0}, Notes: ${message.notes || ''}`}</div>
          </>
        );
        break;
    }
  
    return (
      <li key={message.id} className={containerClass}>
        {content}
      </li>
    );
  };

  // Function to handle Timer
  const renderTimer = (transactionId) => {
    return timers[transactionId]?.display || 'Not Set';
  };
  

  // Render Table Function
  const renderTable = (title, transactions, showAssign, showDecline = true, showCheckbox = false, showDropdown = false, showResult = false) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <table className="min-w-full border border-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th className="border border-gray-700 p-4">Details</th>
            {title !== 'Open Requests' && <th className="border border-gray-700 p-4">Message Count</th>}
            {title !== 'Open Requests' && <th className="border border-gray-700 p-4">Amount Total</th>}
            {title !== 'Open Requests' && <th className="border border-gray-700 p-4">Timer</th>}
            {title !== 'Open Requests' && <th className="border border-gray-700 p-4">Blended Price</th>}
            <th className="border border-gray-700 p-4">Request By</th>
            <th className="border border-gray-700 p-4">System Date</th>
            <th className="border border-gray-700 p-4">Bet Limit</th>
            <th className="border border-gray-700 p-4">Request Price</th>
            {showDropdown && <th className="border border-gray-700 p-4">Set Result</th>}
            {showResult && <th className="border border-gray-700 p-4">Result</th>}
            <th className="border border-gray-700 p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
        {transactions.map((transaction) => {
          const timerStatus = timers[transaction.id]?.display;
          const isFinished = timerStatus === 'Finished';
          const isAmountZero = messages[transaction.id]?.amountTotal === 0 || messages[transaction.id]?.amountTotal == null;

          return (
              <tr 
                key={transaction.id}
                className={`border border-gray-700 p-4 ${updatedTransactionIds.includes(transaction.id) ? 'animate-flash' : ''}`}
              >
                <td className="border border-gray-700 p-4">
                  {`${transaction.bet || ''}, ${transaction.event || ''}, ${transaction.league || ''}, ${transaction.market || ''}`}
                </td>
                {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{messages[transaction.id]?.messageCount || 0}</td>}
                {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{messages[transaction.id]?.amountTotal || 0}</td>}
                {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{renderTimer(transaction.id)}</td>}
                {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{messages[transaction.id]?.blendedPrice.toFixed(2) || 0}</td>}
                <td className="border border-gray-700 p-4">{transaction.requestby || 'N/A'}</td>
                <td className="border border-gray-700 p-4">{transaction.systemdate}</td>
                <td className="border border-gray-700 p-4">{transaction.betlimit || 'N/A'}</td>
                <td className="border border-gray-700 p-4">{transaction.requestprice || 'N/A'}</td>
                {showDropdown && (
                  <td className="border border-gray-700 p-4">
                    <select
                      onChange={async (e) => {
                        const selectedResult = e.target.value;
                        if (selectedResult) {
                          // 1. Update the transaction with the selected result in Firestore
                          const transactionRef = doc(db, 'transactions', transaction.id);
                          await updateDoc(transactionRef, {
                            result: selectedResult,
                            status: 'Closed-Settled' // Optional: Update the status if needed
                          });

                          // 2. Call calculateAndStorePositions with the transaction ID and selected result
                          await calculateAndStorePositions(transaction.id, selectedResult);

                          console.log(`Positions calculated and stored for transaction ${transaction.id}`);
                        }
                      }}
                      className="p-2 rounded w-full bg-gray-700 text-white border border-gray-500"
                    >
                      <option value="" className="bg-gray-800 text-white">Select Result</option>
                      <option value="win" className="bg-gray-800 text-white">Win</option>
                      <option value="win-half" className="bg-gray-800 text-white">Win - Half</option>
                      <option value="loss" className="bg-gray-800 text-white">Loss</option>
                      <option value="loss-half" className="bg-gray-800 text-white">Loss - Half</option>
                      <option value="void" className="bg-gray-800 text-white">Void</option>
                    </select>
                  </td>
                )}              
                {showResult && <td className="border border-gray-700 p-4">{transaction.result}</td>}
                <td className="border border-gray-700 p-4">
                  {showAssign && (
                    <button
                      onClick={() => handleAssign(transaction)}
                      className="bg-blue-600 text-white p-2 rounded m-1"
                    >
                      Assign
                    </button>
                  )}
                  {showDecline && (
                    <button
                      onClick={() => handleDecline(transaction)}
                      className="bg-red-600 text-white p-2 rounded m-1"
                      disabled={ !isAmountZero}
                      style={{
                        opacity: isAmountZero ? 1 : 0.5,
                        cursor: isAmountZero ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Decline
                    </button>
                  )}
                  {title === 'In-Progress' && (
                    <button
                      onClick={() => handleClose(transaction)}
                      className="bg-green-600 text-white p-2 rounded m-1"
                      disabled={!isFinished}
                      style={{ opacity: isFinished ? 1 : 0.5, cursor: isFinished ? 'pointer' : 'not-allowed' }}
                    >
                      Close
                    </button>
                  )}
                  {/* Add the View Messages button */}
                  {title === 'In-Progress' && (
                    <button
                      onClick={() => handleTimer(transaction)}
                      className="bg-green-600 text-white p-2 rounded m-1"
                    >
                      Timer
                    </button>
                  )}
                  {/* Add the View Messages button */}
                  <button
                    onClick={() => handleViewMessages(transaction)}
                    className="bg-yellow-600 text-white p-2 rounded m-1"
                  >
                    View Messages
                  </button>
                  {/* New Results button for Closed-Settled transactions */}
                  {transaction.status === 'Closed-Settled' && (
                    <button
                      onClick={() => handleShowResults(transaction)}
                      className="bg-purple-600 text-white p-2 rounded m-1"
                    >
                      Results
                    </button>                  
                  )}
                  {/* New Client BetSlip button for Closed-UnSettled and Closed-Settled */}
                  {(transaction.status === 'Closed-UnSettled' || transaction.status === 'Closed-Settled') && (
                    <button
                      onClick={() => handleShowBetSlip(transaction)}
                      className="bg-indigo-600 text-white p-2 rounded m-1"
                    >
                      Client BetSlip
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="relative bg-gray-900 text-white p-4 min-h-screen">
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded shadow-md hover:bg-red-600"
        >
          Logout
        </button>
        {/* Reports Button */}
        <button
          onClick={() => navigate('/reports')}  // Add this button for Reports
          className="absolute top-4 right-24 bg-blue-500 text-white p-2 rounded shadow-md hover:bg-blue-600"
        >
          Reports
        </button>
        {/* New-Request Button */}
        <button
          onClick={() => navigate('/submit-request')}  // Add this button for Reports
          className="absolute top-4 right-44 bg-blue-500 text-white p-2 rounded shadow-md hover:bg-blue-600"
        >
          New-Request
        </button>      

      <h1 className="text-3xl font-bold mb-6">Manager Dashboard</h1>
      {renderTable('Open Requests', transactions.filter((t) => t.status === 'Open'), true)}
      {renderTable('In-Progress', transactions.filter((t) => t.status === 'In-Progress'), true, true, true)}
      {renderTable('Closed - UnSettled', transactions.filter((t) => t.status === 'Closed-UnSettled'), false, false, false, true)}
      {renderTable('Closed - Settled', transactions.filter((t) => t.status === 'Closed-Settled'), false, false, false, false, true)}
      {renderTable('Declined', transactions.filter((t) => t.status === 'Declined'), false, false)}

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white">
            <h3 className="text-lg font-bold">Decline Request</h3>
            <p className="text-gray-300"><strong className="text-gray-300">Message: </strong>"Sorry, Cannot fulfill that request"</p>
            <div className="mt-4">
              <button onClick={handleDeclineSubmit} className="bg-red-500 text-white p-2 rounded mr-2">
                Submit
              </button>
              <button onClick={() => setShowDeclineModal(false)} className="bg-gray-500 text-white p-2 rounded">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white">
            <h3 className="text-lg font-bold">Assign Request</h3>
            {/* Modal Content */}
            <div className="mt-4">
              <h4>Select Agents</h4>
              {agents.map((agent) => {
                const onlineDuration = agent.isOnline
                  ? Math.floor((Date.now() - agent.lastActive) / 60000)
                  : null;

                return (
                  <div key={agent.id}>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        value={agent.id}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAgents((prev) => [...prev, agent.id]);
                          } else {
                            setSelectedAgents((prev) => prev.filter((id) => id !== agent.id));
                          }
                        }}
                        className={`${agent.isOnline ? 'text-green-600 font-bold' : ''}`}
                      />
                      <span className={agent.isOnline ? 'text-green-600 font-bold' : 'text-gray-300'}>
                        {agent.name}
                      </span>
                      {agent.isOnline && onlineDuration !== null && (
                        <span className="text-sm text-gray-400 ml-2">
                          {onlineDuration} {onlineDuration === 1 ? 'minute' : 'minutes'} online
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}

              <div className="mt-4">
                <label>
                  Bet Limit:
                  <input
                    type="text"
                    value={betLimit}
                    onChange={(e) => setBetLimit(e.target.value)}
                    className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <label>
                  Seek Price:
                  <input
                    type="text"
                    value={seekPrice}
                    onChange={(e) => setSeekPrice(e.target.value)}
                    className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <label>
                  Message:
                  <textarea
                    value={agentMessage}
                    onChange={(e) => setAgentMessage(e.target.value)}
                    className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <button onClick={handleAssignSubmit} className="bg-blue-600 text-white p-2 rounded mr-2">
                  Submit
                </button>
                <button onClick={() => setShowAssignModal(false)} className="bg-gray-500 text-white p-2 rounded">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white">
            <h3 className="text-lg font-bold">Close Transaction</h3>
            {/* Modal Content */}
            <div className="mt-4">
              <div className="mt-4">
                <p><strong>Bet Limit:</strong> {betLimit}</p>
                <p><strong>Request Price:</strong> {seekPrice}</p>
                <p><strong>Amount Total:</strong> {clientAmount}</p>
                <p><strong>Blended Price:</strong> {messages[selectedTransaction.id]?.blendedPrice.toFixed(2) || 0}</p>
              </div>
              <div className="mt-4">
                <h4>Assign to Client</h4>
                <label>
                  Client Amount:
                  <input
                    type="text"
                    value={clientAmount}
                    onChange={(e) => setClientAmount(e.target.value)}
                    className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <label>
                  Client Price:
                  <input
                    type="text"
                    value={clientPrice}
                    onChange={(e) => setClientPrice(e.target.value)}
                    className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <button onClick={handleCloseSubmit} className="bg-green-600 text-white p-2 rounded mr-2">
                  Submit
                </button>
                <button onClick={() => setShowCloseModal(false)} className="bg-gray-500 text-white p-2 rounded">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>        
      )}

      {/* Timer Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white">
            <h3 className="text-lg font-bold">Notify Close Transaction Timer</h3>
            {/* Modal Content */}
            <div className="mt-4">
              <div className="mt-4">
                <label>
                  Seconds Until Close:
                  <input
                    type="text"
                    value={timer}
                    onChange={(e) => setTimer(e.target.value)}
                    className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <button onClick={handleTimerSubmit} className="bg-green-600 text-white p-2 rounded mr-2">
                  Submit
                </button>
                <button onClick={() => setShowTimerModal(false)} className="bg-gray-500 text-white p-2 rounded">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>        
      )}

      {/* View Messages */}
      {showMessagesModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 text-white p-6 rounded-lg max-h-[80vh] overflow-y-auto w-[90%] sm:w-[70%] lg:w-[50%]">
            <h3 className="text-lg font-bold">Messages for Transaction</h3>
            <ul className="mt-4 space-y-2">
              {transactionMessages.map((message) => renderMessage(message))}
            </ul>
            <button
              onClick={() => setShowMessagesModal(false)}
              className="mt-4 bg-gray-500 text-white p-2 rounded w-full hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>      
      )}

      {/* Results Modal */}
      {selectedTransactionId && (
        <ResultsModal transactionId={selectedTransactionId} onClose={handleCloseResults} />
      )}

      {/* Client BetSlip Modal */}
      {showBetSlipModal && selectedBetSlipTransaction && (
        <BetSlipModal
          transaction={selectedBetSlipTransaction}
          onClose={handleCloseBetSlipModal}
        />
      )}

    </div>
  );
};

export default ManagerPage;