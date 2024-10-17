// src/components/BetSlipModal.js

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { FaCopy } from 'react-icons/fa'; // Using react-icons for the copy icon

const BetSlipModal = ({ transaction, onClose }) => {
  const [clientMessage, setClientMessage] = useState(null);
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (transaction) {
      // Fetch the message where type = 'client_fill'
      const messagesQuery = query(
        collection(db, 'messages_client'),
        where('transactionId', '==', transaction.id),
        where('type', '==', 'client_fill')
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        if (!snapshot.empty) {
          setClientMessage(snapshot.docs[0].data()); // Assuming only one message with 'client_fill'
        } else {
          setClientMessage(null);
        }
      });

      // Cleanup listener on unmount
      return () => unsubscribe();
    }
  }, [transaction]);

  if (!clientMessage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-gray-800 p-6 rounded shadow-lg text-white relative">
          <h3 className="text-lg font-bold mb-4">Client BetSlip</h3>
          <p>No client fill information available for this transaction.</p>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white p-2 rounded mt-4"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const modalContent = `
    Transaction ID: ${transaction.id}
    Bet: ${transaction.bet || ''}
    Event: ${transaction.event || ''}
    Market: ${transaction.market || ''}
    League: ${transaction.league || ''}
    Stake Amount: ${clientMessage.client_amount || 0}
    Price: ${clientMessage.client_price || 0}
    Timestamp: ${clientMessage.timestamp ? clientMessage.timestamp.toDate().toLocaleString() : ''}
  `;

  const handleCopy = () => {
    navigator.clipboard.writeText(modalContent)
      .then(() => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000); // Clear message after 2 seconds
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
        setCopySuccess('Failed to copy!');
        setTimeout(() => setCopySuccess(''), 2000);
      });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-gray-800 p-6 rounded shadow-lg text-white relative w-96">
        {/* Copy Icon */}
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 text-white hover:text-gray-300"
          title="Copy to clipboard"
        >
          <FaCopy size={20} />
        </button>
        {/* Optional: Display copy success message */}
        {copySuccess && (
          <div className="absolute top-12 right-4 bg-green-500 text-white px-2 py-1 rounded">
            {copySuccess}
          </div>
        )}
        <h3 className="text-lg font-bold mb-4">Client BetSlip</h3>
        <div className="mb-4 space-y-2">
            <p className="text-gray-300"><strong className="text-gray-300">Transaction ID:</strong> {transaction.id}</p>
            <p className="text-gray-300"><strong className="text-gray-300">Bet:</strong> {transaction.bet || 'N/A'}</p>
            <p className="text-gray-300"><strong className="text-gray-300">Event:</strong> {transaction.event || 'N/A'}</p>
            <p className="text-gray-300"><strong className="text-gray-300">Market:</strong> {transaction.market || 'N/A'}</p>
            <p className="text-gray-300"><strong className="text-gray-300">League:</strong> {transaction.league || 'N/A'}</p>
            <p className="text-gray-300"><strong className="text-gray-300">Stake Amount:</strong> {clientMessage.client_amount || 0}</p>
            <p className="text-gray-300"><strong className="text-gray-300">Price:</strong> {clientMessage.client_price || 0}</p>
            <p className="text-gray-300"><strong className="text-gray-300">Timestamp:</strong> {clientMessage.timestamp ? clientMessage.timestamp.toDate().toLocaleString() : 'N/A'}</p>
        </div>
        <button
          onClick={onClose}
          className="bg-gray-500 text-white p-2 rounded mt-4 w-full hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default BetSlipModal;
