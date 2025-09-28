        var submissions = [
            {
                id: 1,
                name: "John Smith",
                email: "john@example.com",
                subject: "Product Inquiry",
                type: "Product Support",
                date: "2024-09-25",
                status: "Pending Response",
                message: "Hi, I'm interested in learning more about your premium subscription plans. Could you provide me with detailed pricing information and feature comparisons? I'm particularly interested in the enterprise features and bulk discounts. Thank you!"
            },
            {
                id: 2,
                name: "Sarah Johnson",
                email: "sarah@company.com",
                subject: "Technical Issue",
                type: "Technical Support",
                date: "2024-09-24",
                status: "Responded",
                message: "I'm experiencing login issues with my account. Every time I try to log in, I get an error message saying 'Invalid credentials' even though I'm sure my password is correct. I've tried resetting my password multiple times but the issue persists. Can you please help me resolve this?"
            },
            {
                id: 3,
                name: "Mike Wilson",
                email: "mike.wilson@email.com",
                subject: "Billing Question",
                type: "Billing",
                date: "2024-09-23",
                status: "Pending Response",
                message: "I have a question about my recent invoice. I noticed I was charged twice for the same service this month. The charges appeared on September 1st and September 15th. Could you please look into this and provide clarification? My account number is #12345."
            },
            {
                id: 4,
                name: "Emma Davis",
                email: "emma@startup.com",
                subject: "Feature Request",
                type: "General",
                date: "2024-09-22",
                status: "Responded",
                message: "I love using your platform! I have a suggestion for a new feature that could really benefit users like me. It would be great if you could add a dark mode option to the dashboard. Many of us work late hours and it would be easier on the eyes. Is this something you're considering for future updates?"
            },
            {
                id: 5,
                name: "David Brown",
                email: "david.brown@corp.com",
                subject: "Integration Support",
                type: "Technical Support",
                date: "2024-09-21",
                status: "Pending Response",
                message: "We're trying to integrate your API with our existing system but running into some authentication issues. Our development team has followed the documentation but we're getting a 401 error when making requests. Could someone from your technical team provide guidance on proper authentication setup?"
            }
        ];

        var currentSubmission = null;
        var currentSort = { column: null, direction: 'asc' };
        var filteredSubmissions = [...submissions];

        var emailTemplates = {
            "product-support": {
                subject: "Re: Product Inquiry - Detailed Information",
                message: "Dear [Customer Name],\n\nThank you for your interest in our premium subscription plans. I'm happy to provide you with the detailed information you requested.\n\nOur premium plans include:\n- Advanced features and functionality\n- Priority customer support\n- Extended storage options\n- Enterprise-level security\n\nFor detailed pricing and bulk discount information, I've attached our pricing guide. I'd also be happy to schedule a call to discuss your specific needs and how we can best serve your organization.\n\nPlease let me know if you have any questions or would like to proceed with a consultation.\n\nBest regards,\n[Your Name]\nCustomer Success Team"
            },
            "technical-support": {
                subject: "Re: Technical Issue - Resolution Steps",
                message: "Dear [Customer Name],\n\nThank you for contacting our technical support team. I understand you're experiencing issues, and I'm here to help resolve this for you.\n\nBased on your description, here are the steps we recommend:\n\n1. Clear your browser cache and cookies\n2. Try logging in using an incognito/private browsing window\n3. Ensure you're using the correct login URL\n4. Check if caps lock is enabled when entering your password\n\nIf these steps don't resolve the issue, please don't hesitate to reach out. We can also schedule a screen-sharing session to work through this together.\n\nOur technical team is available Monday-Friday 9AM-6PM EST for additional support.\n\nBest regards,\n[Your Name]\nTechnical Support Team"
            },
            "billing": {
                subject: "Re: Billing Question - Account Review",
                message: "Dear [Customer Name],\n\nThank you for reaching out regarding your billing inquiry. I've reviewed your account and can see the charges you're referring to.\n\nI've identified the duplicate charge and have initiated a refund for the incorrect billing. You should see the refund processed within 3-5 business days. I've also added a credit to your account as an apology for the inconvenience.\n\nI've reviewed your billing settings to prevent this from happening again. If you have any additional questions about your account or billing, please don't hesitate to contact us.\n\nBest regards,\n[Your Name]\nBilling Support Team"
            },
            "general": {
                subject: "Re: Your Inquiry - We're Here to Help",
                message: "Dear [Customer Name],\n\nThank you for contacting us and for your suggestion about adding a dark mode option. We really appreciate feedback from users like you!\n\nI'm pleased to let you know that dark mode is actually on our development roadmap for the next quarter. Your feedback helps us prioritize features that matter most to our users.\n\nI'll make sure to add you to our beta testing list so you can try out the dark mode feature before it's officially released.\n\nWe value your feedback and are always looking for ways to improve our service. If you have any additional questions or suggestions, please don't hesitate to contact us.\n\nBest regards,\n[Your Name]\nCustomer Service Team"
            }
        };

        function showNotification(message, type = 'success') {
            var notification = document.getElementById('notification');
            var notificationText = document.getElementById('notificationText');
            
            notificationText.textContent = message;
            
            if (type === 'error') {
                notification.style.background = 'linear-gradient(135deg, var(--error-color) 0%, #dc2626 100%)';
            } else {
                notification.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)';
            }
            
            notification.classList.add('show');
            
            setTimeout(function() {
                notification.classList.remove('show');
            }, 4000);
        }

        function updateStats() {
            var total = submissions.length;
            var pending = submissions.filter(function(s) { return s.status === 'Pending Response'; }).length;
            var responded = submissions.filter(function(s) { return s.status === 'Responded'; }).length;
            var responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
            
            document.getElementById('totalCount').textContent = total;
            document.getElementById('pendingCount').textContent = pending;
            document.getElementById('respondedCount').textContent = responded;
            document.getElementById('responseRate').textContent = responseRate + '%';
        }

        function clearFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('statusFilter').value = '';
            document.getElementById('typeFilter').value = '';
            filterSubmissions();
            showNotification('Filters cleared successfully!');
        }

        function filterSubmissions() {
            var searchTerm = document.getElementById('searchInput').value.toLowerCase();
            var statusFilter = document.getElementById('statusFilter').value;
            var typeFilter = document.getElementById('typeFilter').value;

            filteredSubmissions = submissions.filter(function(submission) {
                var matchesSearch = !searchTerm || 
                    submission.name.toLowerCase().includes(searchTerm) ||
                    submission.email.toLowerCase().includes(searchTerm) ||
                    submission.subject.toLowerCase().includes(searchTerm) ||
                    submission.message.toLowerCase().includes(searchTerm);
                    
                var matchesStatus = !statusFilter || submission.status === statusFilter;
                var matchesType = !typeFilter || submission.type === typeFilter;
                
                return matchesSearch && matchesStatus && matchesType;
            });

            loadSubmissions();
        }

        function sortTable(column) {
            var direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
            currentSort = { column: column, direction: direction };

            // Update visual indicators
            document.querySelectorAll('th').forEach(function(th) {
                th.classList.remove('sort-asc', 'sort-desc');
            });
            document.querySelector('th[onclick="sortTable(\'' + column + '\')"]').classList.add('sort-' + direction);

            filteredSubmissions.sort(function(a, b) {
                var aVal = a[column];
                var bVal = b[column];
                
                if (column === 'date') {
                    aVal = new Date(aVal);
                    bVal = new Date(bVal);
                }
                
                if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            loadSubmissions();
        }

        function loadSubmissions() {
            var tbody = document.querySelector('#submissionsTable tbody');
            var noResults = document.getElementById('noResults');
            tbody.innerHTML = '';

            if (filteredSubmissions.length === 0) {
                noResults.style.display = 'block';
                return;
            } else {
                noResults.style.display = 'none';
            }

            filteredSubmissions.forEach(function(submission) {
                var row = tbody.insertRow();
                var formattedDate = new Date(submission.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                row.innerHTML = 
                    '<td><strong>' + submission.name + '</strong></td>' +
                    '<td>' + submission.email + '</td>' +
                    '<td>' + (submission.subject.length > 40 ? submission.subject.substring(0, 40) + '...' : submission.subject) + '</td>' +
                    '<td>' + submission.type + '</td>' +
                    '<td>' + formattedDate + '</td>' +
                    '<td><span class="status-badge status-' + submission.status.toLowerCase().replace(' ', '-') + '">' + submission.status + '</span></td>' +
                    '<td><button class="view-btn" onclick="openModal(' + submission.id + ')"><i class="fas fa-eye"></i>View Details</button></td>';
            });
        }

        function openModal(id) {
            currentSubmission = submissions.find(function(s) { return s.id === id; });
            if (!currentSubmission) return;

            document.getElementById('modalName').textContent = currentSubmission.name;
            document.getElementById('modalEmail').textContent = currentSubmission.email;
            document.getElementById('modalSubject').textContent = currentSubmission.subject;
            document.getElementById('modalType').textContent = currentSubmission.type;
            document.getElementById('modalDate').textContent = new Date(currentSubmission.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('modalId').textContent = '#' + currentSubmission.id;
            document.getElementById('modalMessage').textContent = currentSubmission.message;
            document.getElementById('statusSelect').value = currentSubmission.status;

            // Reset form
            document.getElementById('replySubject').value = 'Re: ' + currentSubmission.subject;
            document.getElementById('templateSelect').value = '';
            document.getElementById('replyMessage').value = '';
            document.getElementById('templateInfo').style.display = 'none';

            document.getElementById('submissionModal').classList.add('show');
        }

        function closeModal() {
            document.getElementById('submissionModal').classList.remove('show');
            currentSubmission = null;
        }

        function updateStatus() {
            if (!currentSubmission) return;
            
            var newStatus = document.getElementById('statusSelect').value;
            var oldStatus = currentSubmission.status;
            currentSubmission.status = newStatus;
            
            // Update in main array
            var submissionIndex = submissions.findIndex(function(s) { return s.id === currentSubmission.id; });
            if (submissionIndex !== -1) {
                submissions[submissionIndex].status = newStatus;
                filterSubmissions(); // Refresh display
                updateStats();
                
                if (oldStatus !== newStatus) {
                    showNotification('Status updated successfully!');
                }
            }
        }

        function loadTemplate() {
            var templateSelect = document.getElementById('templateSelect');
            var selectedTemplate = templateSelect.value;
            var replyMessage = document.getElementById('replyMessage');
            var replySubject = document.getElementById('replySubject');
            var templateInfo = document.getElementById('templateInfo');

            if (selectedTemplate && emailTemplates[selectedTemplate]) {
                var template = emailTemplates[selectedTemplate];
                replySubject.value = template.subject;
                replyMessage.value = template.message.replace('[Customer Name]', currentSubmission.name);
                templateInfo.style.display = 'block';
            } else if (selectedTemplate === 'custom') {
                replySubject.value = 'Re: ' + currentSubmission.subject;
                replyMessage.value = '';
                templateInfo.style.display = 'none';
            } else {
                templateInfo.style.display = 'none';
            }
        }

        function sendResponse() {
            var subject = document.getElementById('replySubject').value.trim();
            var message = document.getElementById('replyMessage').value.trim();
            var sendBtn = document.querySelector('.send-btn');

            if (!subject || !message) {
                showNotification('Please fill in both subject and message before sending.', 'error');
                return;
            }

            // Disable button during sending
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Sending...';

            // Simulate sending delay
            setTimeout(function() {
                showNotification('Email sent successfully to ' + currentSubmission.email + '!');

                // Update status if it was pending
                if (currentSubmission.status === 'Pending Response') {
                    currentSubmission.status = 'Responded';
                    document.getElementById('statusSelect').value = 'Responded';
                    
                    var submissionIndex = submissions.findIndex(function(s) { return s.id === currentSubmission.id; });
                    if (submissionIndex !== -1) {
                        submissions[submissionIndex].status = 'Responded';
                        filterSubmissions();
                        updateStats();
                    }
                }

                // Reset form
                document.getElementById('replySubject').value = 'Re: ' + currentSubmission.subject;
                document.getElementById('replyMessage').value = '';
                document.getElementById('templateSelect').value = '';
                document.getElementById('templateInfo').style.display = 'none';

                // Re-enable button
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>Send Response';
            }, 2000);
        }

        // Event listeners
        document.getElementById('submissionModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        // Auto-save draft functionality
        var draftTimer;
        document.getElementById('replyMessage').addEventListener('input', function() {
            clearTimeout(draftTimer);
            draftTimer = setTimeout(function() {
                console.log('Draft saved automatically');
            }, 2000);
        });

        // Initialize
        function init() {
            updateStats();
            loadSubmissions();
            
            // Set initial date sort (newest first)
            sortTable('date');
            currentSort.direction = 'desc';
            sortTable('date');
        }

        init();
