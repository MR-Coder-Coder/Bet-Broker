import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Import Firebase

const Reports = () => {
  const [journalEntries, setJournalEntries] = useState([]);
  const [totalDR, setTotalDR] = useState(0); // Grand total for DR
  const [totalCR, setTotalCR] = useState(0); // Grand total for CR

  useEffect(() => {
    const fetchJournalsFromAllTransactions = async () => {
      const transactionsRef = collection(db, 'transactions');
      const transactionSnapshot = await getDocs(transactionsRef);
      let allJournalEntries = [];

      for (const transactionDoc of transactionSnapshot.docs) {
        const transactionId = transactionDoc.id;

        try {
          const journalsRef = collection(db, 'transactions', transactionId, 'Journals');
          const journalSnapshot = await getDocs(journalsRef);

          if (!journalSnapshot.empty) {
            const journalEntries = journalSnapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                transactionId, // Add the transactionId for reference
                ...data,
              };
            });

            allJournalEntries = [...allJournalEntries, ...journalEntries]; // Append the journal entries
          }
        } catch (error) {
          console.error(`Error fetching journals for transaction ${transactionId}:`, error);
        }
      }

      // Sort by nominal code ascending
      allJournalEntries.sort((a, b) => a.nomcode - b.nomcode);


      // Set the journal entries
      setJournalEntries(allJournalEntries);

      // Calculate totals outside of the loop
      const drTotal = allJournalEntries.reduce((sum, entry) => sum + parseFloat(entry.DR || 0), 0);
      const crTotal = allJournalEntries.reduce((sum, entry) => sum + parseFloat(entry.CR || 0), 0);

      setTotalDR(drTotal);
      setTotalCR(crTotal);
    };

    fetchJournalsFromAllTransactions();
  }, []);

  return (
    <div className="bg-gray-900 text-white p-6 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Trial Balance Report</h1>

      {journalEntries.length > 0 ? (
        <>
          <table className="min-w-full border border-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="border border-gray-700 p-4">Nominal Code</th>
                <th className="border border-gray-700 p-4">Nominal Name</th>
                <th className="border border-gray-700 p-4">Type</th>
                <th className="border border-gray-700 p-4">DR</th>
                <th className="border border-gray-700 p-4">CR</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.map((journal) => (
                <tr key={journal.id}>
                  <td className="border border-gray-700 p-4">{journal.nomcode}</td>
                  <td className="border border-gray-700 p-4">{journal.nomname}</td>
                  <td className="border border-gray-700 p-4">{journal.acc_type}</td>
                  <td className="border border-gray-700 p-4">{journal.DR}</td>
                  <td className="border border-gray-700 p-4">{journal.CR}</td>
                </tr>
              ))}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr className="bg-gray-800 font-bold">
                <td className="border border-gray-700 p-4" colSpan="3">Total</td>
                <td className="border border-gray-700 p-4">{totalDR}</td>
                <td className="border border-gray-700 p-4">{totalCR}</td>
              </tr>
            </tfoot>
          </table>
        </>
      ) : (
        <p>No journal entries found across all transactions.</p>
      )}
    </div>
  );
};

export default Reports;
