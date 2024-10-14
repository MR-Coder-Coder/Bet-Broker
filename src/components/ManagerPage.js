import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { handleTransactionResult, generateAgentJournals, generateAdditionalJournals } from './transactionLogic'; // Import the business logic

const ManagerPage = () => {
  const navigate = useNavigate();
  
  // State Hooks
  const [transactions, setTransactions] = useState([]);
  const [messages, setMessages] = useState({});
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [betLimit, setBetLimit] = useState('');
  const [seekPrice, setSeekPrice] = useState('');
  const [clientAmount, setClientAmount] = useState('');
  const [clientPrice, setClientPrice] = useState('');
  const [agentMessage, setAgentMessage] = useState('');

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

      setTransactions(sortedTransactions);
    });

    // Set up a real-time listener for messages_agents
    const messagesQuery = collection(db, 'messages_agents');
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const newMessages = {};

      querySnapshot.forEach((doc) => {
        const message = doc.data();
        const transactionId = message.transactionId;

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

      setMessages(newMessages);
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
  const handleAssign = (transaction) => {
    setSelectedTransaction(transaction);
    setBetLimit(transaction.betlimit || '');
    setSeekPrice(transaction.seekprice || '');
    setAgentMessage('');
    setShowAssignModal(true);
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
            {title !== 'Open Requests' && <th className="border border-gray-700 p-4">Blended Price</th>}
            <th className="border border-gray-700 p-4">Request By</th>
            <th className="border border-gray-700 p-4">System Date</th>
            <th className="border border-gray-700 p-4">Bet Limit</th>
            <th className="border border-gray-700 p-4">Request Price</th>
            {showCheckbox && <th className="border border-gray-700 p-4">Update Status</th>}
            {showDropdown && <th className="border border-gray-700 p-4">Set Result</th>}
            {showResult && <th className="border border-gray-700 p-4">Result</th>}
            <th className="border border-gray-700 p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="border border-gray-700 p-4">
                {`${transaction.bet || ''}, ${transaction.event || ''}, ${transaction.league || ''}, ${transaction.market || ''}`}
              </td>
              {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{messages[transaction.id]?.messageCount || 0}</td>}
              {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{messages[transaction.id]?.amountTotal || 0}</td>}
              {title !== 'Open Requests' && <td className="border border-gray-700 p-4">{messages[transaction.id]?.blendedPrice.toFixed(2) || 0}</td>}
              <td className="border border-gray-700 p-4">{transaction.requestby || 'N/A'}</td>
              <td className="border border-gray-700 p-4">{transaction.systemdate}</td>
              <td className="border border-gray-700 p-4">{transaction.betlimit || 'N/A'}</td>
              <td className="border border-gray-700 p-4">{transaction.requestprice || 'N/A'}</td>
              {showCheckbox && (
                <td className="border border-gray-700 p-4">
                  <input
                    type="checkbox"
                    onChange={async (e) => {
                      if (e.target.checked) {
                        const transactionRef = doc(db, 'transactions', transaction.id);
                        await updateDoc(transactionRef, {
                          status: 'Closed-UnSettled',
                        });

                        for (const agentId of transaction.AssignedAgents || []) {
                          await addDoc(collection(db, 'messages_agents'), {
                            transactionId: transaction.id,
                            timestamp: new Date(),
                            agentId: agentId,
                            message: 'Manager has closed transaction',
                            type: 'close',
                          });
                        }
                      }
                    }}
                  />
                </td>
              )}
              {showDropdown && (
                <td className="border border-gray-700 p-4">
                  <select
                    onChange={async (e) => {
                      const selectedResult = e.target.value;
                      if (selectedResult) {
                        await handleTransactionResult(transaction.id, selectedResult);  // Call the separate function
                        const lastJrnlNo = await generateAgentJournals(transaction.id, selectedResult);  // Call the separate function
                        await generateAdditionalJournals(transaction.id, selectedResult, lastJrnlNo);
                      }
                    }}
                    className="p-2 rounded w-full bg-gray-700 text-white border border-gray-500"
                  >
                    <option value="" className="bg-gray-800 text-white">Select Result</option>
                    <option value="win" className="bg-gray-800 text-white">Win</option>
                    <option value="lose" className="bg-gray-800 text-white">Lose</option>
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
                  >
                    Decline
                  </button>
                )}
                {title === 'In-Progress' && (
                  <button
                    onClick={() => handleClose(transaction)}
                    className="bg-green-600 text-white p-2 rounded m-1"
                  >
                    Close
                  </button>
                )}
              </td>
            </tr>
          ))}
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
        <button
          onClick={() => navigate('/reports')}  // Add this button for Reports
          className="absolute top-4 right-24 bg-blue-500 text-white p-2 rounded shadow-md hover:bg-blue-600"
        >
          Reports
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
            <p>Message: "Sorry, Cannot fulfill that request"</p>
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
              {agents.map((agent) => (
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
                    />
                    <span>{agent.name}</span>
                  </label>
                </div>
              ))}
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
    </div>
  );
};

export default ManagerPage;