import fetchCompanyDetails from "../api/loadCompanyInfo.js";

let submissions = [];
const API_BASE_URL = "/api/v1";

async function loadDynamicCompanyInfo() {
    try {
        const company = await fetchCompanyDetails();
        if (!company) return;

        if (company.company_name) {
            document.title = "Contact Submissions";
        }

        try {
            const icons = document.querySelectorAll('link[rel~="icon"]');
            if (icons && icons.length) {
                icons.forEach((link) => {
                    if (company.icon_logo_url) link.href = company.icon_logo_url;
                    else if (company.alt_logo_url) link.href = company.alt_logo_url;
                });
            } else {
                const link = document.createElement("link");
                link.rel = "icon";
                link.type = "image/png";
                link.href =
                    company.icon_logo_url ||
                    company.alt_logo_url ||
                    "/assets/favicon/favicon-32x32.png";
                document.head.appendChild(link);
            }
        } catch (e) {
            console.warn("Failed to set favicon", e);
        }

        try {
            const logoContainer = document.getElementById("companyLogo");
            if (logoContainer && company.logoHtml) {
                logoContainer.innerHTML = company.logoHtml;
            }
        } catch (e) { }
    } catch (err) {
        console.warn("Could not load company details:", err);
    }
}

var currentPage = 1;
var pageLimit = 10;
var totalItems = 0;
// Tracks total items excluding archived (for active view pagination)
var activeTotalItems = 0;
// Remember last raw status filter value user selected (to know if viewing archived)
var lastStatusFilter = "";

var serverStats = null;

async function fetchSubmissions(page = 1) {
    try {
        currentPage = page || 1;

        const search = document.getElementById("searchInput")
            ? document.getElementById("searchInput").value.trim()
            : "";
        const statusRaw = document.getElementById("statusFilter")
            ? document.getElementById("statusFilter").value
            : "";
        lastStatusFilter = statusRaw || "";
        const type = document.getElementById("typeFilter")
            ? document.getElementById("typeFilter").value
            : "";
        const fromDate = document.getElementById("fromDate")
            ? document.getElementById("fromDate").value
            : "";
        const toDate = document.getElementById("toDate")
            ? document.getElementById("toDate").value
            : "";

        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(pageLimit));
        if (search) params.set("search", search);
        const status = mapStatusForApi(statusRaw);
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const url = `${API_BASE_URL}/contact-us?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch submissions");
        const data = await res.json();

        serverStats = data.stats || data.totals || data.counts || null;

        submissions = Array.isArray(data.submissions)
            ? data.submissions
            : Array.isArray(data)
                ? data
                : data.submissions || [];
        totalItems =
            typeof data.total === "number"
                ? data.total
                : data.totalCount || submissions.length;
        pageLimit = typeof data.limit === "number" ? data.limit : pageLimit;

        if (type) {
            filteredSubmissions = submissions.filter(function (s) {
                return (
                    String(s.type || "").toLowerCase() === String(type).toLowerCase()
                );
            });
        } else {
            filteredSubmissions = [...submissions];
        }
        // Exclude archived items from active view (only when not explicitly filtering for Archived)
        let viewingArchived = statusRaw && String(statusRaw).toLowerCase() === 'archived';
        if (!viewingArchived) {
            filteredSubmissions = filteredSubmissions.filter(function (s) {
                return String(s.status || '').toLowerCase() !== 'archived';
            });
        }

        // If archiving removed items from the current page, attempt to backfill from subsequent pages
        // so the page remains "full" (up to pageLimit) for a smoother UX.
        if (!viewingArchived && filteredSubmissions.length < pageLimit) {
            const needed = pageLimit - filteredSubmissions.length;
            // We will fetch subsequent pages until we fill or run out.
            // Safeguard against excessive loops: cap at 8 extra pages.
            let nextPage = currentPage + 1;
            let safety = 0;
            while (filteredSubmissions.length < pageLimit && safety < 8) {
                const totalPagesApprox = Math.max(1, Math.ceil((totalItems || 0) / pageLimit));
                if (nextPage > totalPagesApprox) break;
                try {
                    const extraParams = new URLSearchParams();
                    extraParams.set('page', String(nextPage));
                    extraParams.set('limit', String(pageLimit));
                    if (search) extraParams.set('search', search);
                    if (type) extraParams.set('type', type);
                    if (fromDate) extraParams.set('fromDate', fromDate);
                    if (toDate) extraParams.set('toDate', toDate);
                    // Do NOT pass status 'archived' because we want only active here.
                    const extraUrl = `${API_BASE_URL}/contact-us?${extraParams.toString()}`;
                    const extraRes = await fetch(extraUrl);
                    if (!extraRes.ok) break;
                    const extraData = await extraRes.json();
                    const extraSubs = Array.isArray(extraData.submissions)
                        ? extraData.submissions
                        : Array.isArray(extraData)
                            ? extraData
                            : extraData.submissions || [];
                    // Filter out archived again
                    const activeExtras = extraSubs.filter(s => String(s.status || '').toLowerCase() !== 'archived');
                    // Append until we fill
                    for (let i = 0; i < activeExtras.length && filteredSubmissions.length < pageLimit; i++) {
                        // De-duplicate by id if already present
                        const candidate = activeExtras[i];
                        if (!filteredSubmissions.some(r => r.id === candidate.id)) {
                            filteredSubmissions.push(candidate);
                        }
                    }
                } catch (e) {
                    break; // stop attempting further pages on error
                }
                nextPage++;
                safety++;
            }
        }
        // Derive an "active" total using server stats if available
        try {
            let archivedCount = 0;
            if (serverStats) {
                archivedCount =
                    serverStats.archived ||
                    serverStats.archivedCount ||
                    (serverStats.statusCounts && (serverStats.statusCounts.archived || serverStats.statusCounts.Archived)) ||
                    0;
            }
            if (!viewingArchived) {
                activeTotalItems = Math.max(0, (totalItems || 0) - archivedCount);
            } else {
                // When viewing archived explicitly, active total becomes archived total for clarity
                activeTotalItems = archivedCount || filteredSubmissions.length;
            }
        } catch (e) {
            activeTotalItems = (!viewingArchived) ? totalItems : filteredSubmissions.length;
        }
        updateStats();
        loadSubmissions();
        renderPagination();
    } catch (err) {
        showNotification("Error loading submissions: " + err.message, "error");
        submissions = [];
        filteredSubmissions = [];
        totalItems = 0;
        activeTotalItems = 0;
        updateStats();
        loadSubmissions();
        renderPagination();
    }
}
var currentSubmission = null;
var currentSort = { column: null, direction: "asc" };
var filteredSubmissions = [...submissions];

var emailTemplates = {
    "general-inquiry": {
        subject: function (ctx) {
            return ctx.propertyName
                ? "Re: " + ctx.propertyName + " — General Inquiry"
                : "Re: General Inquiry";
        },
        message:
            "Dear {{name}},\n\nThank you for reaching out with your inquiry. We're happy to help and appreciate your interest." +
            "\n\nIf you have any additional details or questions you’d like us to consider, just reply to this email and we’ll get right back to you." +
            "\n\n\nBest regards,\n[Your Name]\nLeasing Team",
    },
    general: {
        subject: function (ctx) {
            return emailTemplates["general-inquiry"].subject(ctx);
        },
        message: emailTemplates ? undefined : "",
    },
    "property-availability": {
        subject: function (ctx) {
            return ctx.propertyName
                ? "Re: Availability for " + ctx.propertyName
                : "Re: Property Availability";
        },
        message:
            "Dear {{name}},\n\nThanks for your interest. I'm checking the current availability for{{propertyNamePrefix}} and will confirm the units/spaces and earliest move-in dates." +
            "\n\nIn the meantime, please let us know your expected timeline so we can recommend the best options for you." +
            "\n\n\nBest regards,\n[Your Name]\nLeasing Team",
    },
    availability: {
        subject: function (ctx) {
            return emailTemplates["property-availability"].subject(ctx);
        },
        message: emailTemplates ? undefined : "",
    },
    "leasing-terms": {
        subject: function (ctx) {
            return ctx.propertyName
                ? "Re: Leasing Terms — " + ctx.propertyName
                : "Re: Leasing Terms";
        },
        message:
            "Dear {{name}},\n\nBelow is a summary of our standard leasing terms for{{propertyNamePrefix}}. Specifics may vary by space and final negotiation:" +
            "\n\n• Lease Term: Typically minimum of 24 months, extendable up to 60 months (5 years)\n• Security Deposit: 1-2 months equivalent\n• Advance Rent: 2 months equivalent\n• Fit-out Period: Subject to approval and space condition\n• Inclusions: Basic building services; utilities billed separately unless otherwise stated" +
            "\n\nIf you'd like, I can prepare an initial proposal based on your requirements." +
            "\n\n\nBest regards,\n[Your Name]\nLeasing Team",
    },
    leasing: {
        subject: function (ctx) {
            return emailTemplates["leasing-terms"].subject(ctx);
        },
        message: emailTemplates ? undefined : "",
    },
    feedback: {
        subject: function () {
            return "Re: Your Feedback";
        },
        message:
            "Dear {{name}},\n\nThank you for sharing your feedback. We truly appreciate you taking the time to help us improve." +
            "\n\nWe’ve noted your comments and will review them with the team. If you’re open to it, we’d love to ask a few follow-up questions to better understand your experience." +
            "\n\n\nBest regards,\n[Your Name]\nCustomer Experience",
    },
    "schedule-viewing": {
        subject: function (ctx) {
            return ctx.propertyName
                ? "Re: Schedule a Viewing — " + ctx.propertyName
                : "Re: Schedule a Viewing";
        },
        message:
            "Dear {{name}},\n\nWe’d be happy to schedule a viewing{{propertyNameSuffix}}. Please let us know your preferred dates and time windows (e.g., weekdays 10am–4pm), and the number of attendees." +
            "\n\nOnce we receive your availability, we’ll confirm the appointment and share any visitor/access guidelines." +
            "\n\n\nBest regards,\n[Your Name]\nLeasing Team",
    },
    viewing: {
        subject: function (ctx) {
            return emailTemplates["schedule-viewing"].subject(ctx);
        },
        message: emailTemplates ? undefined : "",
    },
    "confirmation-viewing": {
        subject: function (ctx) {
            return ctx.propertyName
                ? "Re: Viewing Confirmed — " + ctx.propertyName
                : "Re: Viewing Confirmed";
        },
        message:
            "Dear {{name}},\n\nYour viewing appointment{{propertyNameSuffix}} has been confirmed for [DATE & TIME]. Please arrive 10–15 minutes early to allow time for building access and registration." +
            "\n\nOn the day, kindly bring a valid government-issued ID. If you need to reschedule, reply to this email at least 24 hours in advance and we’ll arrange a new time." +
            "\n\nWe look forward to meeting you and showing you around." +
            "\n\n\nBest regards,\n[Your Name]\nLeasing Team",
    },
};

emailTemplates.general.message = emailTemplates["general-inquiry"].message;
emailTemplates.availability.message =
    emailTemplates["property-availability"].message;
emailTemplates.leasing.message = emailTemplates["leasing-terms"].message;
emailTemplates.viewing.message = emailTemplates["schedule-viewing"].message;

function normalizeTemplateKey(val) {
    if (!val) return "";
    var s = String(val).trim().toLowerCase();
    s = s.replace(/\s+/g, "-").replace(/_/g, "-");
    if (s.includes("general")) return "general-inquiry";
    if (s.includes("availability")) return "property-availability";
    if (s.includes("lease")) return "leasing-terms";
    if (s.includes("feedback")) return "feedback";
    if (s.includes("confirmation")) return "confirmation-viewing";
    if (s.includes("view")) return "schedule-viewing";
    return s;
}

function getSubmissionContext(sub) {
    var first = (sub.first_name || "").trim();
    var last = (sub.last_name || "").trim();
    var name = (first + " " + last).trim() || (sub.name || "").trim() || "there";
    var businessType =
        sub.business_type || sub.businessType || sub.company_type || sub.type || "";
    var preferredSize =
        sub.preferred_space_size || sub.preferredSpaceSize || sub.space_size || "";
    var monthlyBudgetRaw =
        sub.monthly_budget_range ||
        sub.monthly_budget ||
        sub.budget_range ||
        sub.budget ||
        "";
    var propertyName = "";
    var propertyId = "";
    try {
        if (sub.property || sub.property_info) {
            var p = sub.property || sub.property_info;
            var addr =
                p.address && typeof p.address === "object" && !Array.isArray(p.address)
                    ? p.address
                    : null;
            var unitName = p.property_name || p.name || p.unit_name || p.unit || "";
            var buildingName =
                p.building_name ||
                p.building ||
                (addr && (addr.building_name || addr.building)) ||
                p.buildingName ||
                p.project_name ||
                p.development_name ||
                "";

            if (buildingName && unitName) {
                var unitLower = unitName.toLowerCase();
                var buildLower = buildingName.toLowerCase();

                if (unitLower.indexOf(buildLower) === -1) {
                    propertyName = buildingName + " - " + unitName;
                } else {
                    propertyName = unitName;
                }
            } else {
                propertyName = unitName || buildingName || "";
            }
            propertyId = p.property_id || p.propertyId || p.id || "";
        }

        var subjectStr = sub.subject || "";
        if ((!propertyName || !propertyId) && subjectStr) {
            var mBracket = subjectStr.match(
                /\[property:\s*([A-Za-z0-9-]+)\s*\|\s*([^\]]+)\]/i
            );
            if (mBracket) {
                propertyId = propertyId || (mBracket[1] || "").trim();
                propertyName = propertyName || (mBracket[2] || "").trim();
            }

            if (!propertyName || !propertyId) {
                var mPair = subjectStr.match(
                    /property[:#]?\s*([A-Za-z0-9-]+)\s*[-|:]\s*([^\(\n\r]+)/i
                );
                if (mPair) {
                    propertyId = propertyId || (mPair[1] || "").trim();
                    var nm = (mPair[2] || "").trim();

                    nm = nm.replace(/[\s\-\u2013\u2014:|\/]+$/g, "");
                    propertyName = propertyName || nm;
                }
            }

            if (!propertyName) {
                var mName = subjectStr.match(/property_name[:=]\s*([^|;\n\r]+)/i);
                if (mName) {
                    var nm2 = (mName[1] || "")
                        .trim()
                        .replace(/[\s\-\u2013\u2014:|\/]+$/g, "");
                    propertyName = nm2;
                }
            }

            if (!propertyId) {
                var idMatch = subjectStr.match(
                    /property[_\s-]?id\s*[:=#]?\s*([A-Za-z0-9-]+)/i
                );
                if (idMatch) {
                    propertyId = (idMatch[1] || "").trim();
                }
            }

            if (!propertyId) {
                var mUuid = subjectStr.match(
                    /[-\s:|#\u2013\u2014]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i
                );
                if (mUuid && mUuid[1]) {
                    propertyId = mUuid[1];
                } else {
                    var mNum = subjectStr.match(/[-\s:|#\u2013\u2014]*(\d{4,})\s*$/);
                    if (mNum && mNum[1]) propertyId = mNum[1];
                }
            }

            if (!propertyName) {
                var mFor = subjectStr.match(/\bfor\s+([^\-\u2013\u2014\|:]+)\s*$/i);
                if (mFor && mFor[1]) {
                    propertyName = mFor[1].trim();
                }
            }

            if (!propertyName) {
                var emIdx = subjectStr.lastIndexOf("\u2014");
                var enIdx = subjectStr.lastIndexOf("\u2013");
                var spacedHyIdx = subjectStr.lastIndexOf(" - ");
                var sepIndex = -1;
                if (emIdx !== -1) sepIndex = emIdx;
                else if (enIdx !== -1) sepIndex = enIdx;
                else if (spacedHyIdx !== -1) sepIndex = spacedHyIdx;
                if (sepIndex !== -1) {
                    var after = subjectStr.slice(sepIndex + 1).trim();
                    if (sepIndex === spacedHyIdx)
                        after = subjectStr.slice(sepIndex + 3).trim();
                    after = after.replace(/[\s\-\u2013\u2014:|\/]+$/g, "");
                    propertyName = after;
                }
            }

            if (!propertyName && propertyId) {
                try {
                    var rx = new RegExp(
                        "^(.+?)[\\s\\-\\u2013\\u2014:|\\/]*" +
                        escapeRegExp(String(propertyId)) +
                        "\\s*$",
                        "i"
                    );
                    var mLeft = subjectStr.match(rx);
                    if (mLeft && mLeft[1]) {
                        var left = mLeft[1].trim();
                        left = left
                            .replace(/^re\s*[:\-]?\s*/i, "")
                            .replace(/^\[[^\]]+\]\s*/, "")
                            .trim();

                        var forIdx = left.toLowerCase().lastIndexOf(" for ");
                        if (forIdx !== -1) {
                            propertyName = left.slice(forIdx + 5).trim();
                        } else {
                            var lastEm = left.lastIndexOf("\u2014");
                            var lastEn = left.lastIndexOf("\u2013");
                            var lastHy = left.lastIndexOf(" - ");
                            var idx = Math.max(lastEm, lastEn, lastHy);
                            if (idx !== -1) {
                                propertyName = (
                                    idx === lastHy ? left.slice(idx + 3) : left.slice(idx + 1)
                                ).trim();
                            } else {
                                propertyName = left;
                            }
                        }

                        if (propertyName && /\s-\s/.test(propertyName)) {
                            propertyName = propertyName;
                        }
                    }
                } catch (e) {
                    /* noop */
                }
            }

            if (!propertyName) {
                var cleaned = subjectStr
                    .replace(/^re\s*[:\-]?\s*/i, "")
                    .replace(/\[property:[^\]]+\]/gi, "")
                    .replace(/[\s\-\u2013\u2014:|\/]+$/g, "")
                    .trim();
                var fIdx = cleaned.toLowerCase().lastIndexOf(" for ");
                if (fIdx !== -1) {
                    propertyName = cleaned.slice(fIdx + 5).trim();
                } else {
                    var le = cleaned.lastIndexOf("\u2014");
                    var ln = cleaned.lastIndexOf("\u2013");
                    var lh = cleaned.lastIndexOf(" - ");
                    var sidx = Math.max(le, ln, lh);
                    if (sidx !== -1) {
                        propertyName = (
                            sidx === lh ? cleaned.slice(sidx + 3) : cleaned.slice(sidx + 1)
                        ).trim();

                        if (propertyName && !/\s-\s/.test(propertyName) && sidx === lh) {
                            var leftSide = cleaned.slice(0, sidx).trim();

                            var lastSepIdx = Math.max(
                                leftSide.lastIndexOf("\u2014"),
                                leftSide.lastIndexOf("\u2013"),
                                leftSide.lastIndexOf(":")
                            );
                            var candidateBuilding =
                                lastSepIdx !== -1
                                    ? leftSide.slice(lastSepIdx + 1).trim()
                                    : leftSide;
                            if (candidateBuilding && candidateBuilding.length > 2) {
                                propertyName = candidateBuilding + " - " + propertyName;
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        /* noop */
    }

    try {
        var pn = propertyName && String(propertyName).trim();
        if (pn) {
            var isUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    pn
                );
            var isLongNumber = /^\d{6,}$/.test(pn);
            var equalsId =
                propertyId &&
                pn.toLowerCase() === String(propertyId).trim().toLowerCase();
            if (isUuid || isLongNumber || equalsId) {
                propertyName = "";
            }
        }
    } catch (e) {
        /* noop */
    }

    try {
        function cleanPropName(name, pid) {
            if (!name) return "";
            var s = String(name).trim();

            s = s.replace(/\[property:[^\]]+\]/gi, "").trim();

            if (pid) {
                var rx = new RegExp(
                    "[\\s\\-\\u2013\\u2014:|\\/]*" + escapeRegExp(String(pid)) + "\\s*$",
                    "i"
                );
                s = s.replace(rx, "").trim();
            }

            s = s
                .replace(
                    /[\s\-–—:|#\/]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/i,
                    ""
                )
                .trim();

            s = s.replace(/[\s\-–—:|#\/]*\d{4,}\s*$/, "").trim();

            s = s
                .replace(
                    /\(\s*(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|\d{4,})\s*\)\s*$/i,
                    ""
                )
                .trim();

            s = s.replace(/[\s\-\u2013\u2014:|\/]+$/g, "").trim();
            return s;
        }
        if (propertyName) {
            propertyName = cleanPropName(propertyName, propertyId);
        }
    } catch (e) {
        /* noop */
    }

    return {
        name: name,
        firstName: first,
        lastName: last,
        email: sub.email || "",
        businessType: businessType,
        preferredSize: preferredSize,
        monthlyBudget: monthlyBudgetRaw,
        propertyName: propertyName,
        propertyId: propertyId,

        propertyNamePrefix: propertyName ? " " + propertyName : " this property",
        propertyNameSuffix: propertyName ? " for " + propertyName : "",
    };
}

function fillTemplate(str, ctx) {
    if (!str) return "";
    return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, key) {
        return ctx[key] !== undefined && ctx[key] !== null ? String(ctx[key]) : "";
    });
}

function getReplyMessageText() {
    var editor = document.getElementById("replyEditor");
    if (editor) {
        try {
            var html = editor.innerHTML || "";

            html = html.replace(/<br\s*\/?>/gi, "\n");
            html = html.replace(/<\/p>/gi, "\n\n");
            html = html.replace(/<\/div>/gi, "\n");
            html = html.replace(/<li>/gi, "\n• ");

            var tmp = document.createElement("div");
            tmp.innerHTML = html;
            return String(tmp.textContent || tmp.innerText || "").trim();
        } catch (e) {
            /* fallback */
        }
    }
    var el = document.getElementById("replyMessage");
    if (!el) return "";
    try {
        if (typeof el.value !== "undefined") return String(el.value);
        return String(el.innerText || el.textContent || "");
    } catch (e) {
        return "";
    }
}

function setReplyMessageText(val) {
    var editor = document.getElementById("replyEditor");
    var el = document.getElementById("replyMessage");
    if (editor) {
        try {
            editor.innerHTML = textToHtml(val || "");
        } catch (e) {
            editor.textContent = val || "";
        }
    }
    if (!el) return;
    try {
        if (typeof el.value !== "undefined") el.value = String(val || "");
        else el.innerText = String(val || "");
    } catch (e) {
        try {
            el.innerText = String(val || "");
        } catch (e) {
            /* noop */
        }
    }
}

function setupComposeEditor() {
    var editor = document.getElementById("replyEditor");
    var textarea = document.getElementById("replyMessage");
    var toolbar = document.getElementById("composeToolbar");
    if (!editor) return;

    if (toolbar) {
        toolbar.querySelectorAll("button").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var cmd = btn.getAttribute("data-cmd");
                var val = btn.getAttribute("data-value") || null;
                if (!cmd) return;
                if (cmd === "createLink") {
                    const promptFn = (typeof window !== 'undefined' && typeof window.showPrompt === 'function')
                        ? ((msg, placeholder, title) => window.showPrompt(msg, placeholder, title))
                        : (msg => Promise.resolve(prompt(String(msg))));
                    promptFn("Enter URL (include http:// or https://):", "https://", "Insert link").then(url => {
                        if (url) document.execCommand("createLink", false, url);
                    });
                } else if (cmd === "formatBlock" && val) {
                    document.execCommand("formatBlock", false, val);
                } else {
                    document.execCommand(cmd, false, val);
                }
                syncEditorToTextarea();
                try {
                    editor.focus();
                } catch (e) { }
            });
        });
    }

    function syncEditorToTextarea() {
        if (!textarea) return;
        try {
            var html = editor.innerHTML || "";

            var tmp = document.createElement("div");

            var t = html
                .replace(/<br\s*\/?>(\s*)/gi, "\n")
                .replace(/<\/p>/gi, "\n\n")
                .replace(/<\/div>/gi, "\n")
                .replace(/<li>/gi, "\n• ");
            tmp.innerHTML = t;
            textarea.value = tmp.textContent || tmp.innerText || "";
        } catch (e) { }
    }

    editor.addEventListener("input", function () {
        syncEditorToTextarea();
    });
    editor.addEventListener("blur", function () {
        syncEditorToTextarea();
    });
}

function textToHtml(text) {
    if (!text && text !== "") return "";
    var s = String(text || "");

    s = escapeHtml(s);

    s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    var parts = s
        .split(/\n{2,}/g)
        .map(function (p) {
            return p.trim();
        })
        .filter(function (p) {
            return p.length > 0;
        });
    if (!parts.length) return "<p></p>";
    var html = parts
        .map(function (p) {
            var inner = p.replace(/\n/g, "<br>");
            return '<p style="margin:0 0 12px;">' + inner + "</p>";
        })
        .join("");
    return html;
}

function cleanEditorHtml(html) {
    if (!html) return "";
    try {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = String(html);

        const ALLOWED_TAGS = new Set([
            "p",
            "br",
            "b",
            "strong",
            "i",
            "em",
            "u",
            "ul",
            "ol",
            "li",
            "a",
            "blockquote",
            "div",
            "span",
        ]);

        function sanitizeNode(node) {
            if (node.nodeType === Node.TEXT_NODE) return;
            if (node.nodeType !== Node.ELEMENT_NODE) {
                node.remove();
                return;
            }
            const tag = node.tagName.toLowerCase();

            try {
                const styleAttr =
                    (node.getAttribute && node.getAttribute("style")) || "";
                if (styleAttr && typeof styleAttr === "string") {
                    const s = styleAttr.toLowerCase();
                    const wrappers = [];
                    if (/font-weight\s*:\s*(bold|700|800|900|bolder)/.test(s))
                        wrappers.push("strong");
                    if (/font-style\s*:\s*italic/.test(s)) wrappers.push("em");
                    if (/text-decoration\s*:\s*underline/.test(s)) wrappers.push("u");
                    if (wrappers.length && node.tagName.toLowerCase() === "span") {
                        let outer = document.createElement(wrappers[0]);
                        let current = outer;
                        for (let i = 1; i < wrappers.length; i++) {
                            const w = document.createElement(wrappers[i]);
                            current.appendChild(w);
                            current = w;
                        }
                        while (node.firstChild) current.appendChild(node.firstChild);
                        node.parentNode.replaceChild(outer, node);

                        sanitizeNode(outer);
                        return;
                    }
                }
            } catch (e) {
                /* ignore style handling errors */
            }

            if (!ALLOWED_TAGS.has(tag)) {
                if (node.childNodes && node.childNodes.length) {
                    const parent = node.parentNode;
                    while (node.firstChild) parent.insertBefore(node.firstChild, node);
                }
                node.parentNode.removeChild(node);
                return;
            }

            for (let i = node.attributes.length - 1; i >= 0; i--) {
                const attr = node.attributes[i].name.toLowerCase();
                if (tag === "a" && attr === "href") {
                    const v = node.getAttribute("href") || "";
                    if (!/^\s*(https?:|mailto:)/i.test(v)) {
                        node.removeAttribute("href");
                    }
                } else {
                    node.removeAttribute(node.attributes[i].name);
                }
            }

            const children = Array.from(node.childNodes);
            children.forEach(sanitizeNode);
        }

        const children = Array.from(wrapper.childNodes);
        children.forEach(sanitizeNode);

        return wrapper.innerHTML;
    } catch (e) {
        return "";
    }
}

async function buildDetailsSection(ctx) {
    if (
        ctx &&
        ctx.propertyId &&
        (!currentSubmission || !currentSubmission.property)
    ) {
        try {
            var fetchedIfMissing = await fetchPropertyById(ctx.propertyId);
            if (
                fetchedIfMissing &&
                (fetchedIfMissing.property_name || fetchedIfMissing.name)
            ) {
                ctx.propertyName =
                    fetchedIfMissing.property_name || fetchedIfMissing.name;
                ctx.propertyNameSuffix = ctx.propertyName
                    ? " for " + ctx.propertyName
                    : "";
                ctx.propertyNamePrefix = ctx.propertyName
                    ? " " + ctx.propertyName
                    : " this property";
                try {
                    if (currentSubmission) currentSubmission.property = fetchedIfMissing;
                } catch (e) {
                    /* noop */
                }
            }
        } catch (e) {
            /* noop */
        }
    }

    if (
        ctx &&
        ctx.propertyId &&
        (!ctx.propertyName || !ctx.propertyName.trim())
    ) {
        try {
            var fetched = await fetchPropertyById(ctx.propertyId);
            if (fetched && (fetched.property_name || fetched.name)) {
                ctx.propertyName = fetched.property_name || fetched.name;
                ctx.propertyNamePrefix = ctx.propertyName
                    ? " " + ctx.propertyName
                    : " this property";
                ctx.propertyNameSuffix = ctx.propertyName
                    ? " for " + ctx.propertyName
                    : "";
                try {
                    if (currentSubmission) currentSubmission.property = fetched;
                } catch (e) {
                    /* noop */
                }
            }
        } catch (e) {
            /* noop */
        }
    }

    var lines = [];
    if (ctx && ctx.propertyName) lines.push("• Property: " + ctx.propertyName);
    if (ctx && ctx.businessType)
        lines.push("• Business/Inquiry Type: " + ctx.businessType);
    if (ctx && ctx.preferredSize)
        lines.push("• Space Size: " + ctx.preferredSize);
    if (ctx && ctx.monthlyBudget)
        lines.push("• Monthly Rent: " + formatBudgetText(ctx.monthlyBudget));

    if (!lines.length) return "";
    return "\n\nYour submission details:\n" + lines.join("\n");
}

function formatBudgetText(raw) {
    if (!raw) return "";
    var s = String(raw).trim();
    var mRange = s.match(/([0-9,.]+)\s*[-–—]\s*([0-9,.]+)/);
    if (mRange) {
        var n1 = Number(mRange[1].replace(/[^0-9.]/g, ""));
        var n2 = Number(mRange[2].replace(/[^0-9.]/g, ""));
        if (!isNaN(n1) && !isNaN(n2))
            return "₱" + n1.toLocaleString() + " – ₱" + n2.toLocaleString();
    }
    var mUnder = s.match(/under\s*\D*([0-9,.]+)/i);
    if (mUnder) {
        var n = Number(mUnder[1].replace(/[^0-9.]/g, ""));
        if (!isNaN(n)) return "Under ₱" + n.toLocaleString();
    }
    var mOver = s.match(/over\s*\D*([0-9,.]+)/i);
    if (mOver) {
        var n2 = Number(mOver[1].replace(/[^0-9.]/g, ""));
        if (!isNaN(n2)) return "Over ₱" + n2.toLocaleString();
    }
    var num = Number(s.replace(/[^0-9.-]+/g, ""));
    if (!isNaN(num) && /\d/.test(s)) return "₱" + num.toLocaleString();
    return s;
}

function ensureTemplateLoader() {
    var el = document.getElementById("templateLoader");
    if (el) return el;
    var sel = document.getElementById("templateSelect");
    if (!sel) return null;
    el = document.createElement("span");
    el.id = "templateLoader";
    el.style.marginLeft = "8px";
    el.style.fontSize = "0.9rem";
    el.style.color = "var(--text-muted)";
    el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    sel.parentNode.insertBefore(el, sel.nextSibling);
    el.style.display = "none";
    return el;
}

function showTemplateLoading() {
    try {
        var t = ensureTemplateLoader();
        if (t) t.style.display = "inline-block";
    } catch (e) {
        /* noop */
    }
}

function hideTemplateLoading() {
    try {
        var t = document.getElementById("templateLoader");
        if (t) t.style.display = "none";
    } catch (e) {
        /* noop */
    }
}

function showNotification(message, type = "success") {
    var notification = document.getElementById("notification");
    var notificationText = document.getElementById("notificationText");

    notificationText.textContent = message;

    if (type === "error") {
        notification.style.background =
            "linear-gradient(135deg, var(--error-color) 0%, #dc2626 100%)";
    } else {
        notification.style.background =
            "linear-gradient(135deg, var(--success-color) 0%, #059669 100%)";
    }

    notification.classList.add("show");

    setTimeout(function () {
        notification.classList.remove("show");
    }, 4000);
}

function updateStats() {
    var pageTotal = submissions.length;
    var pagePending = submissions.filter(function (s) {
        var status = (s.status || "").toLowerCase();
        return (
            status === "pending" || status === "pending response" || status === "new"
        );
    }).length;
    var pageResponded = submissions.filter(function (s) {
        var status = (s.status || "").toLowerCase();
        return (
            status === "responded" || status === "replied" || status === "resolved"
        );
    }).length;
    var pageResponseRate =
        pageTotal > 0 ? Math.round((pageResponded / pageTotal) * 100) : 0;

    // If we are hiding archived locally, show active page slice count instead of raw page total
    var showingArchived = lastStatusFilter && lastStatusFilter.toLowerCase() === 'archived';
    var visiblePageCount = showingArchived ? submissions.filter(s => String(s.status || '').toLowerCase() === 'archived').length : submissions.filter(s => String(s.status || '').toLowerCase() !== 'archived').length;
    document.getElementById("totalCount").textContent = showingArchived ? pageTotal : visiblePageCount;
    document.getElementById("pendingCount").textContent = pagePending;
    document.getElementById("respondedCount").textContent = pageResponded;
    document.getElementById("responseRate").textContent = pageResponseRate + "%";

    if (
        serverStats &&
        (typeof serverStats.total === "number" ||
            typeof serverStats.pending === "number" ||
            typeof serverStats.responded === "number")
    ) {
        // Prefer activeTotalItems for total when not explicitly viewing archived
        var sTotal = (showingArchived
            ? (serverStats.archived || serverStats.archivedCount || (serverStats.statusCounts && serverStats.statusCounts.archived) || pageTotal)
            : (activeTotalItems || serverStats.total || totalItems || pageTotal));
        var sPending =
            serverStats.pending ||
            serverStats.pendingCount ||
            (serverStats.statusCounts && serverStats.statusCounts.pending) ||
            pagePending;
        var sResponded =
            serverStats.responded ||
            serverStats.replied ||
            serverStats.respondedCount ||
            (serverStats.statusCounts && serverStats.statusCounts.responded) ||
            pageResponded;
    document.getElementById("totalCount").textContent = sTotal;
        document.getElementById("pendingCount").textContent = sPending;
        document.getElementById("respondedCount").textContent = sResponded;
        var sRate = sTotal > 0 ? Math.round((sResponded / sTotal) * 100) : 0;
        document.getElementById("responseRate").textContent = sRate + "%";
        return;
    }

    var total =
        typeof (showingArchived ? totalItems : activeTotalItems || totalItems) === "number" && (showingArchived ? totalItems : activeTotalItems || totalItems) >= 0 ? (showingArchived ? totalItems : activeTotalItems || totalItems) : pageTotal;
    if (!total || total <= pageTotal) {
        return;
    }

    (async function fetchAggregatedCounts() {
        try {
            const perPage = 1000;
            const pages = Math.max(1, Math.ceil(total / perPage));

            var aggPending = 0;
            var aggResponded = 0;

            for (let p = 1; p <= pages; p++) {
                const params = new URLSearchParams();
                params.set("page", String(p));
                params.set("limit", String(perPage));
                const url = `${API_BASE_URL}/contact-us?${params.toString()}`;
                const res = await fetch(url);
                if (!res.ok)
                    throw new Error(
                        "Failed to fetch page " + p + " for aggregated stats"
                    );
                const data = await res.json();
                const rows = Array.isArray(data.submissions)
                    ? data.submissions
                    : Array.isArray(data)
                        ? data
                        : data.submissions || [];
                rows.forEach(function (s) {
                    const st = (s.status || "").toLowerCase();
                    if (st === "pending" || st === "pending response" || st === "new")
                        aggPending++;
                    else if (st === "responded" || st === "replied" || st === "resolved")
                        aggResponded++;
                });
            }

            var finalTotal = total;
            document.getElementById("totalCount").textContent = finalTotal;
            document.getElementById("pendingCount").textContent = aggPending;
            document.getElementById("respondedCount").textContent = aggResponded;
            var finalRate =
                finalTotal > 0 ? Math.round((aggResponded / finalTotal) * 100) : 0;
            document.getElementById("responseRate").textContent = finalRate + "%";
        } catch (err) {
            console.warn("Aggregated stats load failed:", err);
        }
    })();
}

function clearFilters() {
    var si = document.getElementById("searchInput");
    var sf = document.getElementById("statusFilter");
    var tf = document.getElementById("typeFilter");
    var fd = document.getElementById("fromDate");
    var td = document.getElementById("toDate");

    if (si) si.value = "";
    if (sf) sf.value = "";
    if (tf) tf.value = "";
    if (fd) fd.value = "";
    if (td) td.value = "";

    fetchSubmissions(1);
    showNotification("Filters cleared successfully!");
}

function filterSubmissions() {
    fetchSubmissions(1);
}

function sortTable(column) {
    var direction =
        currentSort.column === column && currentSort.direction === "asc"
            ? "desc"
            : "asc";
    currentSort = { column: column, direction: direction };

    document.querySelectorAll("th").forEach(function (th) {
        th.classList.remove("sort-asc", "sort-desc");
    });
    document
        .querySelector("th[onclick=\"sortTable('" + column + "')\"]")
        .classList.add("sort-" + direction);

    filteredSubmissions.sort(function (a, b) {
        var aVal;
        var bVal;

        if (column === "name") {
            aVal = ((a.first_name || "") + " " + (a.last_name || ""))
                .trim()
                .toLowerCase();
            bVal = ((b.first_name || "") + " " + (b.last_name || ""))
                .trim()
                .toLowerCase();
        } else if (column === "date") {
            aVal = a.submitted_at || a.date || a.created_at || "";
            bVal = b.submitted_at || b.date || b.created_at || "";
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (column === "status") {
            aVal = (a.status || "").toLowerCase();
            bVal = (b.status || "").toLowerCase();
        } else {
            aVal = a[column];
            bVal = b[column];
            if (typeof aVal === "string") aVal = aVal.toLowerCase();
            if (typeof bVal === "string") bVal = bVal.toLowerCase();
        }

        if (aVal === undefined || aVal === null) aVal = "";
        if (bVal === undefined || bVal === null) bVal = "";

        if (typeof aVal === "number" && typeof bVal === "number") {
            if (aVal < bVal) return direction === "asc" ? -1 : 1;
            if (aVal > bVal) return direction === "asc" ? 1 : -1;
            return 0;
        }

        aVal = String(aVal);
        bVal = String(bVal);
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
    });

    loadSubmissions();
}

function loadSubmissions() {
    var tbody = document.querySelector("#submissionsTable tbody");
    var noResults = document.getElementById("noResults");
    tbody.innerHTML = "";

    if (filteredSubmissions.length === 0) {
        noResults.style.display = "block";
        return;
    } else {
        noResults.style.display = "none";
    }

    filteredSubmissions.forEach(function (submission, index) {
        var row = tbody.insertRow();

        var fullName =
            (submission.first_name || "") +
            (submission.last_name ? " " + submission.last_name : "");

        var formattedDate = submission.submitted_at
            ? new Date(submission.submitted_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            })
            : "";

        var rawSubject = submission.subject || "";
        var sanitized = sanitizeSubject(rawSubject);
        var subject =
            sanitized.length > 60 ? sanitized.substring(0, 60) + "..." : sanitized;

        var statusText = submission.status
            ? submission.status.charAt(0).toUpperCase() + submission.status.slice(1)
            : "";
        var statusClass = submission.status
            ? "status-" + submission.status.toLowerCase().replace(" ", "-")
            : "";

        var startIndex = Math.max(
            0,
            (Number(currentPage || 1) - 1) * Number(pageLimit || 10)
        );
        row.innerHTML =
            "<td>" +
            (startIndex + index + 1) +
            "</td>" +
            "<td><strong>" +
            fullName +
            "</strong></td>" +
            "<td>" +
            (submission.email || "") +
            "</td>" +
            "<td>" +
            renderSubjectCell(subject, rawSubject, submission) +
            "</td>" +
            "<td>" +
            formattedDate +
            "</td>" +
            '<td><span class="status-badge ' +
            statusClass +
            '">' +
            statusText +
            "</span></td>" +
                        '<td>' +
                        '<button class="view-btn" onclick="openModal(' + submission.id + ')"><i class="fas fa-eye"></i> View</button>' +
                        (String(submission.status || '').toLowerCase() !== 'archived'
                            ? ' <button class="archive-btn" onclick="archiveSubmission(' + submission.id + ')"><i class="fas fa-box-archive"></i> Archive</button>'
                            : '') +
                        '</td>';
                try { row.setAttribute('data-submission-id', submission.id); } catch(e) {}
    });
            // Apply highlight if query param present
            try { applySubmissionHighlight && applySubmissionHighlight(); } catch(e) {}
}

function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    container.innerHTML = "";
    const totalForPaging = (lastStatusFilter && lastStatusFilter.toLowerCase() === 'archived') ? (activeTotalItems || totalItems || 0) : (activeTotalItems || totalItems || 0);
    let totalPages = Math.max(1, Math.ceil((totalForPaging || 0) / pageLimit));
    // If after backfill we actually have only enough items for a single page, collapse to 1
    if (totalForPaging <= pageLimit) {
        totalPages = 1;
    }
    // Clamp currentPage if it exceeds recalculated totalPages
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    // Only show Prev when there's more than 1 page
    if (totalPages > 1) {
        const prev = document.createElement("button");
        prev.textContent = "‹ Prev";
        prev.className = "btn";
        prev.disabled = currentPage <= 1;
        prev.onclick = () => changePage(currentPage - 1);
        container.appendChild(prev);
    }

    const maxButtons = 7;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

    for (let p = start; p <= end; p++) {
        const btn = document.createElement("button");
        btn.textContent = String(p);
        btn.className = "btn";
        if (p === currentPage) {
            btn.disabled = true;
            btn.style.fontWeight = "700";
        } else {
            btn.onclick = () => changePage(p);
        }
        container.appendChild(btn);
    }

    // Only show Next when there's more than 1 page
    if (totalPages > 1) {
        const next = document.createElement("button");
        next.textContent = "Next ›";
        next.className = "btn";
        next.disabled = currentPage >= totalPages;
        next.onclick = () => changePage(currentPage + 1);
        container.appendChild(next);
    }

    // Page info summary (Showing X–Y of Z Active / Archived)
    try {
        const infoEl = document.getElementById('pageInfo');
        if (infoEl) {
            const effectiveTotal = totalForPaging || 0;
            const startItem = effectiveTotal ? ((currentPage - 1) * pageLimit) + 1 : 0;
            const endItem = effectiveTotal ? Math.min(startItem + filteredSubmissions.length - 1, effectiveTotal) : 0;
            const label = (lastStatusFilter && lastStatusFilter.toLowerCase() === 'archived') ? 'archived' : 'active';
            infoEl.textContent = filteredSubmissions.length
                ? `Showing ${startItem}-${endItem} of ${effectiveTotal} ${label}`
                : `No ${label} submissions to display`;
        }
    } catch (e) { /* noop */ }
}

function changePage(page) {
    if (page < 1) page = 1;
    const totalForPaging = (lastStatusFilter && lastStatusFilter.toLowerCase() === 'archived') ? (activeTotalItems || totalItems || 0) : (activeTotalItems || totalItems || 0);
    let totalPages = Math.max(1, Math.ceil((totalForPaging || 0) / pageLimit));
    if (totalForPaging <= pageLimit) totalPages = 1;
    if (page > totalPages) page = totalPages;
    fetchSubmissions(page);
}

async function archiveSubmission(id) {
    try {
        const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function') ? window.showConfirm : (msg => Promise.resolve(confirm(String(msg))));
        const ok = await confirmFn('Archive this submission? You can restore it later from Archived.', 'Archive Submission');
        if (!ok) return;
        const res = await fetch(`${API_BASE_URL}/contact-us/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'archived' })
        });
        if (!res.ok) throw new Error('Failed to archive');
        showNotification && showNotification('Submission archived', 'success');
        fetchSubmissions(currentPage || 1);
    } catch (e) {
        console.warn('archiveSubmission error', e);
        showNotification && showNotification('Failed to archive submission', 'error');
    }
}

async function openModal(id) {
    currentSubmission = submissions.find(function (s) {
        return s.id === id;
    });
    if (!currentSubmission) return;

    var fullName =
        (currentSubmission.first_name || "") +
        (currentSubmission.last_name ? " " + currentSubmission.last_name : "");
    document.getElementById("modalName").textContent = fullName;
    document.getElementById("modalEmail").textContent =
        currentSubmission.email || "";

    var rawSub = currentSubmission.subject || "";
    var sanitized = sanitizeSubject(rawSub);
    var propId = null;
    var propName = null;

    if (currentSubmission.property || currentSubmission.property_info) {
        var p = currentSubmission.property || currentSubmission.property_info;
        propId = p.property_id || p.propertyId || p.id || null;

        try {
            var addr =
                p.address && typeof p.address === "object" && !Array.isArray(p.address)
                    ? p.address
                    : null;
            var unitName = p.property_name || p.name || p.unit_name || p.unit || "";
            var buildingName =
                p.building_name ||
                p.building ||
                (addr && (addr.building_name || addr.building)) ||
                p.buildingName ||
                p.project_name ||
                p.development_name ||
                "";
            if (buildingName && unitName) {
                var unitLower = unitName.toLowerCase();
                var buildLower = buildingName.toLowerCase();
                propName =
                    unitLower.indexOf(buildLower) === -1
                        ? buildingName + " - " + unitName
                        : unitName;
            } else {
                propName = unitName || buildingName || null;
            }
        } catch (e) {
            propName = p.property_name || p.name || null;
        }
    }

    if (!propId) {
        var m =
            rawSub.match(/\[property:\s*([A-Za-z0-9-]+)\s*\|\s*([^\]]+)\]/i) ||
            rawSub.match(/property[:#]?\s*([A-Za-z0-9-]+)\s*[-|:]\s*([^\(]+)/i) ||
            rawSub.match(/property_name[:=]\s*([^|;\n\r]+)/i);
        if (m) {
            propId = m[1] || propId;
            propName = (m[2] || "").trim();
        }
    }

    if (propId) {
        try {
            const fetched = await fetchPropertyById(propId);
            if (fetched) {
                if (fetched.property_name || fetched.name) {
                    propName = fetched.property_name || fetched.name;
                }

                try {
                    currentSubmission.property = fetched;
                } catch (e) {
                    /* noop */
                }
            }
        } catch (e) {
            /* noop */
        }
    }

    var modalSubjectEl = document.getElementById("modalSubject");

    if (!propId && rawSub) {
        var mUuid = rawSub.match(
            /[-\s:|#\u2013\u2014]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i
        );
        if (mUuid && mUuid[1]) {
            propId = mUuid[1];
        } else {
            var mNum = rawSub.match(/[-\s:|#\u2013\u2014]*(\d{4,})\s*$/);
            if (mNum && mNum[1]) propId = mNum[1];
        }
    }

    var baseName = propName || rawSub || "";
    if (propId && baseName) {
        try {
            var rx = new RegExp(
                "[\\s\\-:|#\\u2013\\u2014]*" + escapeRegExp(String(propId)) + "\\s*$",
                "i"
            );
            baseName = baseName.replace(rx, "");
        } catch (e) {
            /* noop */
        }

        baseName = baseName.replace(/[\s\-\u2013\u2014:|\/]+$/g, "");
    }

    if (propId) {
        var cleanId = String(propId)
            .trim()
            .replace(/^[-\s:|#\u2013\u2014]+|[-\s:|#\u2013\u2014]+$/g, "");
        var linkText =
            ((propName ? propName : baseName) || sanitized) + " - " + cleanId;
        modalSubjectEl.innerHTML =
            '<a href="#" title="View property" class="subject-link" onclick="openPropertyModal(\'' +
            cleanId.replace(/'/g, "\\'") +
            "', " +
            (currentSubmission.id || "null") +
            '); return false;">' +
            escapeHtml(linkText) +
            "</a>";
    } else {
        var clean = (rawSub || "").replace(/[\s\-\u2013\u2014:|\/]+$/g, "");
        modalSubjectEl.textContent = sanitizeSubject(clean);
    }

    try {
        var btype =
            currentSubmission.business_type ||
            currentSubmission.businessType ||
            currentSubmission.company_type ||
            currentSubmission.type ||
            "";
        var bEl = document.getElementById("modalBusinessType");
        if (bEl) bEl.textContent = btype || "";
    } catch (e) {
        /* noop */
    }

    try {
        var prefSize =
            currentSubmission.preferred_space_size ||
            currentSubmission.preferredSpaceSize ||
            currentSubmission.space_size ||
            "";
        var budgetRaw =
            currentSubmission.monthly_budget_range ||
            currentSubmission.monthly_budget ||
            currentSubmission.budget_range ||
            currentSubmission.budget ||
            "";
        var sizeEl = document.getElementById("modalPreferredSize");
        var budgetEl = document.getElementById("modalMonthlyBudget");

        if (prefSize) {
            var rawSize = String(prefSize).trim();
            var displaySize = "";
            var lower = rawSize.toLowerCase();
            var parsedPrimary = null;
            var parsedSecondary = null;

            var category = "";
            if (/\bsmall\b/i.test(lower)) category = "Small";
            else if (/\bmedium\b/i.test(lower)) category = "Medium";
            else if (/\blarge\b/i.test(lower)) category = "Large";
            else if (/flex|flexible/i.test(lower)) category = "Flexible";

            var mRange = rawSize.match(/([0-9,\.]+)\s*[-–—]\s*([0-9,\.]+)/);
            if (mRange) {
                var n1 = Number(mRange[1].replace(/[^0-9.]/g, ""));
                var n2 = Number(mRange[2].replace(/[^0-9.]/g, ""));
                if (!isNaN(n1) && !isNaN(n2)) {
                    var formattedRange =
                        n1.toLocaleString() + "–" + n2.toLocaleString() + " sqm";

                    var mid = (n1 + n2) / 2;
                    if (!category) {
                        if (mid < 50) category = "Small";
                        else if (mid <= 100) category = "Medium";
                        else category = "Large";
                    }
                    parsedPrimary = n1;
                    parsedSecondary = n2;
                    displaySize = category
                        ? category + " (" + formattedRange + ")"
                        : formattedRange;
                }
            } else {
                var mNum = rawSize.match(/([0-9,\.]+)/);
                if (mNum && /^\s*[0-9,\.]+\s*(sqm|m2)?\s*$/i.test(rawSize)) {
                    var n = Number(mNum[1].replace(/[^0-9.]/g, ""));
                    if (!isNaN(n)) {
                        var fmt = n.toLocaleString() + " sqm";
                        if (!category) {
                            if (n < 50) category = "Small";
                            else if (n <= 100) category = "Medium";
                            else category = "Large";
                        }
                        parsedPrimary = n;
                        displaySize = category ? category + " (" + fmt + ")" : fmt;
                    }
                }
            }

            if (!displaySize && category) {
                var canonical = "";
                if (category === "Small") canonical = "<50 sqm";
                else if (category === "Medium") canonical = "50–100 sqm";
                else if (category === "Large") canonical = ">100 sqm";
                else if (category === "Flexible") canonical = "";

                if (canonical)
                    displaySize = category + (canonical ? " (" + canonical + ")" : "");
                else displaySize = category;
            }

            if (!displaySize) {
                displaySize = rawSize;
            }

            if (sizeEl) {
                var showRaw = false;
                try {
                    if (parsedPrimary !== null) {
                        var rawNumMatch = rawSize.match(/([0-9,\.]+)/);
                        if (rawNumMatch) {
                            var rawNum = Number(rawNumMatch[1].replace(/[^0-9.]/g, ""));
                            if (!isNaN(rawNum)) {
                                if (parsedSecondary !== null) {
                                    if (
                                        rawNum < parsedPrimary - 0.01 ||
                                        rawNum > parsedSecondary + 0.01
                                    )
                                        showRaw = true;
                                } else {
                                    if (Math.abs(rawNum - parsedPrimary) > 0.01) showRaw = true;
                                }
                            } else {
                                showRaw = true;
                            }
                        } else {
                            showRaw = true;
                        }
                    } else {
                        if (category) showRaw = false;
                        else if (displaySize && displaySize !== rawSize) showRaw = true;
                    }
                } catch (e) {
                    showRaw = true;
                }

                if (displaySize) {
                    if (showRaw) {
                        sizeEl.innerHTML =
                            escapeHtml(displaySize) +
                            ' <small style="color:var(--text-muted); font-size:0.9rem;">' +
                            escapeHtml(rawSize) +
                            "</small>";
                    } else {
                        sizeEl.textContent = displaySize;
                    }
                } else {
                    sizeEl.textContent = rawSize || "";
                }
            }
        } else if (sizeEl) {
            sizeEl.textContent = "";
        }

        if (budgetRaw) {
            var budgetText = "";
            var raw = String(budgetRaw).trim();

            var mUnder = raw.match(/under\s*\D*([0-9,\.]+)/i);
            var mOver = raw.match(/over\s*\D*([0-9,\.]+)/i);

            var mRange = raw.match(/([0-9,\.]+)\s*[-–—]\s*([0-9,\.]+)/);

            if (mRange) {
                var n1 = Number(mRange[1].replace(/[^0-9.]/g, ""));
                var n2 = Number(mRange[2].replace(/[^0-9.]/g, ""));
                if (!isNaN(n1) && !isNaN(n2))
                    budgetText = "₱" + n1.toLocaleString() + " – ₱" + n2.toLocaleString();
            } else if (mUnder) {
                var n = Number(mUnder[1].replace(/[^0-9.]/g, ""));
                if (!isNaN(n)) budgetText = "Under ₱" + n.toLocaleString();
                else budgetText = raw;
            } else if (mOver) {
                var n = Number(mOver[1].replace(/[^0-9.]/g, ""));
                if (!isNaN(n)) budgetText = "Over ₱" + n.toLocaleString();
                else budgetText = raw;
            } else if (!isNaN(Number(raw.replace(/[^0-9.-]+/g, "")))) {
                var num = Number(raw.replace(/[^0-9.-]+/g, ""));
                budgetText = "₱" + num.toLocaleString();
            } else {
                budgetText = raw;
            }

            if (budgetEl) budgetEl.textContent = budgetText;
        } else if (budgetEl) {
            budgetEl.textContent = "";
        }
    } catch (e) {
        /* noop */
    }

    if (document.getElementById("modalType"))
        document.getElementById("modalType").textContent = "";
    document.getElementById("modalDate").textContent =
        currentSubmission.submitted_at
            ? new Date(currentSubmission.submitted_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            })
            : "";
    document.getElementById("modalId").textContent = "#" + currentSubmission.id;

    try {
        var repliedEl = document.getElementById("modalRepliedAt");
        if (repliedEl) {
            var repliedRaw =
                currentSubmission.replied_at || currentSubmission.repliedAt || null;
            if (repliedRaw) {
                var repliedDate = new Date(repliedRaw);
                if (!isNaN(repliedDate.getTime())) {
                    repliedEl.textContent = repliedDate.toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                    });
                } else {
                    repliedEl.textContent = String(repliedRaw);
                }
            } else {
                repliedEl.textContent = "";
            }
        }
    } catch (e) {
        /* noop */
    }
    document.getElementById("modalMessage").textContent =
        currentSubmission.message || "";

    var badge = document.getElementById("modalStatusBadge");
    if (badge) {
        var st = currentSubmission.status || "Pending Response";
        badge.textContent = st;
        badge.className =
            "status-badge " + ("status-" + st.toLowerCase().replace(/ /g, "-"));
    }

    var replyBase = sanitizeSubject(currentSubmission.subject || "");
    if (propName) {
        try {
            var pn = String(propName);
            pn = pn
                .replace(
                    /[\s\-–—:|#\/]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/i,
                    ""
                )
                .trim();
            pn = pn.replace(/[\s\-–—:|#\/]*\d{4,}\s*$/, "").trim();
            pn = pn.replace(/[\s\-\u2013\u2014:|\/]+$/g, "").trim();
            replyBase = sanitizeSubject(pn);
        } catch (e) {
            replyBase = sanitizeSubject(propName);
        }
    }

    replyBase = replyBase.replace(/[\s\-\u2013\u2014:\|\/]+$/g, "");
    document.getElementById("replySubject").value = "Re: " + replyBase;
    document.getElementById("templateSelect").value = "";
    setReplyMessageText("");
    document.getElementById("templateInfo").style.display = "none";

    document.getElementById("submissionModal").classList.add("show");
    // Ensure any global page loader overlay does not block modal interaction
    try {
        if (window.PageLoader && typeof PageLoader.hide === 'function') {
            PageLoader.hide();
        }
        var pl = document.getElementById('page-loader');
        if (pl) {
            pl.classList.add('hide');
            setTimeout(function(){ try { pl.remove(); } catch(_){} }, 800);
        }
    } catch(_) { }
}

function closeModal() {
    document.getElementById("submissionModal").classList.remove("show");
    currentSubmission = null;
}

function updateStatus() {
    if (!currentSubmission) return;

    var oldStatus = currentSubmission.status || "Pending Response";
    var newStatus = oldStatus.toLowerCase().includes("respond")
        ? "Pending Response"
        : "Responded";
    currentSubmission.status = newStatus;

    var submissionIndex = submissions.findIndex(function (s) {
        return s.id === currentSubmission.id;
    });
    if (submissionIndex !== -1) {
        submissions[submissionIndex].status = newStatus;
        filterSubmissions();
        updateStats();
        showNotification('Status updated to "' + newStatus + '"', "success");
    }

    var badge = document.getElementById("modalStatusBadge");
    if (badge) {
        badge.textContent = newStatus;
        badge.className =
            "status-badge " +
            ("status-" + newStatus.toLowerCase().replace(/ /g, "-"));
    }
}

async function loadTemplate() {
    var templateSelect = document.getElementById("templateSelect");
    var selectedTemplate = templateSelect.value;
    var replyMessage = document.getElementById("replyMessage");
    var replySubject = document.getElementById("replySubject");
    var templateInfo = document.getElementById("templateInfo");

    var key = normalizeTemplateKey(selectedTemplate);
    if (selectedTemplate === "custom") {
        var customBase = sanitizeSubject(currentSubmission.subject || "");
        customBase = customBase.replace(/[\s\-\u2013\u2014:\|\/]+$/g, "");
        replySubject.value = "Re: " + customBase;
        replyMessage.value = "";
        templateInfo.style.display = "none";
        return;
    }

    if (key && emailTemplates[key]) {
        var template = emailTemplates[key];
        var ctx = getSubmissionContext(currentSubmission);

        if (ctx && ctx.propertyId) {
            if (
                currentSubmission &&
                currentSubmission.property &&
                (currentSubmission.property.property_name ||
                    currentSubmission.property.name)
            ) {
                ctx.propertyName =
                    currentSubmission.property.property_name ||
                    currentSubmission.property.name;
                ctx.propertyNamePrefix = ctx.propertyName
                    ? " " + ctx.propertyName
                    : " this property";
                ctx.propertyNameSuffix = ctx.propertyName
                    ? " for " + ctx.propertyName
                    : "";
            }

            var needFetch = false;
            try {
                if (!currentSubmission || !currentSubmission.property) {
                    needFetch = true;
                } else {
                    var attachedName = (
                        currentSubmission.property.property_name ||
                        currentSubmission.property.name ||
                        ""
                    )
                        .toString()
                        .trim();
                    var parsedName = (ctx.propertyName || "").toString().trim();
                    if (
                        attachedName &&
                        parsedName &&
                        attachedName.toLowerCase() !== parsedName.toLowerCase()
                    ) {
                        needFetch = true;
                    }
                }
            } catch (e) {
                needFetch = true;
            }

            if (needFetch) {
                showTemplateLoading();
                try {
                    var fetched = await fetchPropertyById(ctx.propertyId);
                    if (fetched) {
                        try {
                            if (currentSubmission) currentSubmission.property = fetched;
                        } catch (e) {
                            /* noop */
                        }
                        if (fetched.property_name || fetched.name) {
                            ctx.propertyName = fetched.property_name || fetched.name;
                            ctx.propertyNamePrefix = ctx.propertyName
                                ? " " + ctx.propertyName
                                : " this property";
                            ctx.propertyNameSuffix = ctx.propertyName
                                ? " for " + ctx.propertyName
                                : "";
                        }
                    }
                } catch (e) {
                    /* noop */
                } finally {
                    hideTemplateLoading();
                }
            }
        }

        try {
            for (var k in ctx) {
                if (!Object.prototype.hasOwnProperty.call(ctx, k)) continue;
                try {
                    var v = ctx[k];
                    if (v && typeof v.then === "function") {
                        ctx[k] = await v;
                    }
                } catch (e) {
                    ctx[k] = "";
                }
            }

            for (var kk in ctx) {
                if (!Object.prototype.hasOwnProperty.call(ctx, kk)) continue;
                var vv = ctx[kk];
                if (vv !== null && typeof vv === "object") {
                    try {
                        ctx[kk] = String(vv);
                    } catch (e) {
                        ctx[kk] = "";
                    }
                }
            }
        } catch (e) {
            /* noop */
        }

        // Force templates to prefer the DB property_name if it's attached to the
        // current submission. This is a defensive override to prevent earlier
        // parsed/truncated names from being used when rendering subjects/messages.
        try {
            if (
                currentSubmission &&
                currentSubmission.property &&
                (currentSubmission.property.property_name || currentSubmission.property.name)
            ) {
                var dbPropName = (
                    currentSubmission.property.property_name || currentSubmission.property.name || ""
                )
                    .toString()
                    .trim();
                if (dbPropName) {
                    var parsedPN = (ctx.propertyName || "").toString().trim();
                    if (!parsedPN || parsedPN.toLowerCase() !== dbPropName.toLowerCase()) {
                        ctx.propertyName = dbPropName;
                        ctx.propertyNamePrefix = ctx.propertyName
                            ? " " + ctx.propertyName
                            : " this property";
                        ctx.propertyNameSuffix = ctx.propertyName
                            ? " for " + ctx.propertyName
                            : "";
                    }
                }
            }
        } catch (e) {
            /* noop */
        }

        var subj =
            typeof template.subject === "function"
                ? template.subject(ctx)
                : fillTemplate(template.subject, ctx);
        var baseMsg = fillTemplate(template.message, ctx);

        var details = await Promise.resolve(buildDetailsSection(ctx));
        var msg = baseMsg;
        if (details) {
            var anchorIdx = -1;
            var anchors = ["\n\nBest regards,", "\n\nRegards,", "\n\nSincerely,"];
            for (var i = 0; i < anchors.length; i++) {
                var idx = baseMsg.lastIndexOf(anchors[i]);
                if (idx !== -1) {
                    anchorIdx = idx;
                    break;
                }
            }
            if (anchorIdx !== -1) {
                msg = baseMsg.slice(0, anchorIdx) + details + baseMsg.slice(anchorIdx);
            } else {
                msg = baseMsg + details;
            }
        }

        replySubject.value = subj;
        setReplyMessageText(msg);
        templateInfo.style.display = "block";
    } else {
        templateInfo.style.display = "none";
    }
}

async function sendResponse() {
    var subject = document.getElementById("replySubject").value.trim();
    var message = getReplyMessageText().trim();
    var sendBtn = document.querySelector(".send-btn");

    if (!subject || !message) {
        showNotification(
            "Please fill in both subject and message before sending.",
            "error"
        );
        return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Sending...';

    try {
        const entryId = currentSubmission && currentSubmission.id;

        var editor = document.getElementById("replyEditor");
        var htmlPayload = null;
        try {
            if (editor && editor.innerHTML && editor.innerHTML.trim() !== "") {
                htmlPayload = cleanEditorHtml(editor.innerHTML);
            } else {
                htmlPayload = textToHtml(message);
            }
        } catch (e) {
            htmlPayload = textToHtml(message);
        }

        const res = await fetch(`${API_BASE_URL}/contact-us/${entryId}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: currentSubmission.email,
                subject,
                message,
                html: htmlPayload,
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to send email");
        }

        var serverBody = null;
        try {
            serverBody = await res.json().catch(() => null);
        } catch (e) {
            serverBody = null;
        }
        showNotification(
            "Email sent successfully to " + currentSubmission.email + "!"
        );

        currentSubmission.status = "Responded";
        var badge = document.getElementById("modalStatusBadge");
        if (badge) {
            badge.textContent = "Responded";
            badge.className = "status-badge status-responded";
        }
        var submissionIndex = submissions.findIndex(function (s) {
            return s.id === currentSubmission.id;
        });
        if (submissionIndex !== -1) {
            submissions[submissionIndex].status = "Responded";

            var newRepliedAt = null;
            if (serverBody && (serverBody.replied_at || serverBody.repliedAt)) {
                newRepliedAt = serverBody.replied_at || serverBody.repliedAt;
            } else {
                newRepliedAt = new Date().toISOString();
            }
            submissions[submissionIndex].replied_at = newRepliedAt;
            filterSubmissions();
            updateStats();
        }

        var postReplyBase = sanitizeSubject(currentSubmission.subject || "");
        if (currentSubmission.property || currentSubmission.property_info) {
            var p = currentSubmission.property || currentSubmission.property_info;
            if (p.property_name || p.name) {
                var baseName = p.property_name || p.name;
                try {
                    baseName = String(baseName)
                        .replace(
                            /[\s\-–—:|#\/]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/i,
                            ""
                        )
                        .replace(/[\s\-–—:|#\/]*\d{4,}\s*$/, "")
                        .replace(/[\s\-\u2013\u2014:|\/]+$/g, "")
                        .trim();
                } catch (e) {
                    /* noop */
                }
                postReplyBase = sanitizeSubject(baseName);
            }
        }
        postReplyBase = postReplyBase.replace(/[\s\-\u2013\u2014:\|\/]+$/g, "");
        document.getElementById("replySubject").value = "Re: " + postReplyBase;
        setReplyMessageText("");
        document.getElementById("templateSelect").value = "";
        document.getElementById("templateInfo").style.display = "none";

        try {
            var repliedEl = document.getElementById("modalRepliedAt");
            if (repliedEl) {
                var repliedRaw =
                    (serverBody && (serverBody.replied_at || serverBody.repliedAt)) ||
                    new Date().toISOString();
                var repliedDate = new Date(repliedRaw);
                if (!isNaN(repliedDate.getTime())) {
                    repliedEl.textContent = repliedDate.toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                    });
                } else {
                    repliedEl.textContent = String(repliedRaw);
                }
                try {
                    currentSubmission.replied_at = repliedRaw;
                } catch (e) { }
            }
        } catch (e) {
            /* noop */
        }
    } catch (e) {
        showNotification(e.message || "Failed to send email", "error");
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>Send Response';
    }
}

document
    .getElementById("submissionModal")
    .addEventListener("click", function (e) {
        if (e.target === this) {
            closeModal();
        }
    });

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeModal();
    }
});

var draftTimer;
function attachDraftSaver() {
    var editor = document.getElementById("replyEditor");
    var textarea = document.getElementById("replyMessage");
    var target = editor || textarea;
    if (!target) return;
    target.addEventListener("input", function () {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(function () {
            console.log("Draft saved automatically");
        }, 2000);
    });
}
try {
    attachDraftSaver();
} catch (e) {
    /* noop */
}

function sanitizeSubject(text) {
    if (!text) return "";

    return text
        .replace(
            /\[?\s*(?:property[_\s-]?id|propertyid|prop[_\s-]?id|property)\s*[:=#-]?\s*([A-Za-z0-9-]*\d+[A-Za-z0-9-]*)\s*\]?/gi,
            ""
        )

        .replace(/\(?#\s*\d+\)?/g, "")
        .replace(/\(property\s*#\s*\d+\)/gi, "")

        .replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            ""
        )
        .trim();
}

function renderSubjectCell(displayText, rawText, submission) {
    try {
        var propId = null;
        var propName = null;
        if (submission && (submission.property || submission.property_info)) {
            var p = submission.property || submission.property_info;
            propId = p.property_id || p.propertyId || p.id || null;
            propName = p.property_name || p.name || null;
        }

        if (!propId && rawText) {
            var m =
                rawText.match(/\[property:\s*([A-Za-z0-9-]+)\s*\|\s*([^\]]+)\]/i) ||
                rawText.match(/property[:#]?\s*([A-Za-z0-9-]+)\s*[-|:]\s*([^\(]+)/i) ||
                rawText.match(/property[_\s-]?id[:=#]?\s*([A-Za-z0-9-]+)/i);
            if (m) {
                propId = propId || (m[1] && m[1].trim());
                propName = propName || (m[2] && m[2].trim());
            }
        }

        if (propId) {
            var label = escapeHtml(displayText || propName || propId);
            var idLink =
                ' <a href="#" title="View property" class="subject-link small" onclick="openPropertyModal(\'' +
                String(propId).replace(/'/g, "\\'") +
                "'," +
                (submission.id || "null") +
                '); return false;">' +
                escapeHtml(propId) +
                "</a>";
            return label + idLink;
        }
    } catch (e) {
        console.warn("renderSubjectCell error", e);
    }
    return escapeHtml(displayText);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openPropertyModal(propertyId, submissionId) {
    try {
        var submission = submissions.find((s) => s.id === submissionId) || null;
        var prop = null;
        if (submission && (submission.property || submission.property_info)) {
            prop = submission.property || submission.property_info;
        }

        if (!prop) {
            prop = await fetchPropertyById(propertyId);
        }

        showPropertyInModal(
            prop || {
                property_name: "Unknown",
                street: "",
                city: "",
                province: "",
                base_rent: "—",
                floor_area_sqm: "—",
            }
        );
        document.getElementById("propertyDetailModal").classList.add("show");
        // Safety: hide loader if still present so property modal is clickable
        try {
            if (window.PageLoader && typeof PageLoader.hide === 'function') {
                PageLoader.hide();
            }
            var pl = document.getElementById('page-loader');
            if (pl) {
                pl.classList.add('hide');
                setTimeout(function(){ try { pl.remove(); } catch(_){} }, 800);
            }
        } catch(_) { }
    } catch (err) {
        console.warn("Failed to open property modal", err);
        showNotification("Could not load property details", "error");
    }
}

function closePropertyModal() {
    document.getElementById("propertyDetailModal").classList.remove("show");
}

async function fetchPropertyById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();

    function unwrapProperty(payload) {
        if (!payload) return null;

        if (payload.property) return payload.property;
        if (payload.data) {
            const d = payload.data;
            if (d.property) return d.property;
            if (Array.isArray(d) && d.length) return d[0];
            if (typeof d === "object") return d;
        }
        if (payload.properties) {
            const arr = payload.properties;
            if (Array.isArray(arr) && arr.length) {
                const found = arr.find((p) => (p.property_id || p.id) === cleanId);
                return found || arr[0];
            }
        }
        if (Array.isArray(payload) && payload.length) return payload[0];

        if (payload.property_id || payload.property_name || payload.name)
            return payload;
        return null;
    }

    const endpoints = [
        "/api/v1/properties/" + encodeURIComponent(cleanId),
        "/api/v1/properties?id=" + encodeURIComponent(cleanId),
    ];
    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                continue;
            }
            const data = await res.json();
            const prop = unwrapProperty(data);
            if (prop) return prop;
        } catch (e) { }
    }
    return null;
}

function showPropertyInModal(p) {
    if (!p) p = {};
    const name = p.property_name || p.name || "Unknown Property";
    document.getElementById("propertyDetailTitle").textContent =
        name || "Property Details";
    document.getElementById("propertyDetailName").textContent = name;

    const addrObj =
        p.address && typeof p.address === "object" && !Array.isArray(p.address)
            ? p.address
            : null;
    const addressParts = [
        p.building_name || (addrObj && addrObj.building_name),
        p.street || (addrObj && addrObj.street),
        p.barangay || (addrObj && addrObj.barangay),
        p.city || (addrObj && addrObj.city) || p.city_town,
        p.province || (addrObj && addrObj.province),
        p.postal_code || (addrObj && addrObj.postal_code),
        p.country || (addrObj && addrObj.country),
    ].filter(Boolean);
    const address = addressParts.join(", ");
    document.getElementById("propertyDetailAddress").textContent =
        address || p.location || "";

    const rent = p.base_rent ?? p.rent ?? p.monthly_rent;
    document.getElementById("propertyDetailRent").textContent =
        rent !== undefined && rent !== null && rent !== "" ? String(rent) : "—";

    const area = p.floor_area_sqm ?? p.area_sqm ?? p.floor_area;
    document.getElementById("propertyDetailArea").textContent =
        area !== undefined && area !== null && area !== "" ? area + " sqm" : "—";

    const status = (p.property_status || p.status || "").toString().trim();

    function mapPropertyStatusClass(st) {
        if (!st) return "";
        const s = st.toLowerCase();
        if (s === "available") return "property-available";
        if (s === "occupied" || s === "leased" || s === "rented")
            return "property-occupied";
        if (s.includes("maintenance") || s === "under maintenance")
            return "property-maintenance";
        if (s === "reserved" || s === "pending") return "property-reserved";

        return "property-archived";
    }
    const propClass = mapPropertyStatusClass(status);
    if (status) {
        document.getElementById("propertyDetailStatus").innerHTML =
            '<span class="property-status ' +
            propClass +
            '">' +
            escapeHtml(status) +
            "</span>";
    } else {
        document.getElementById("propertyDetailStatus").innerHTML = "";
    }
    const img = p.display_image || p.image_url || (p.images && p.images[0]) || "";
    if (img) document.getElementById("propertyDetailImage").src = img;
}

function init() {
    loadDynamicCompanyInfo();
    fetchSubmissions();
    try {
        setupComposeEditor();
    } catch (e) {
        /* noop */
    }

    var fd = document.getElementById("fromDate");
    var td = document.getElementById("toDate");
    if (fd)
        fd.addEventListener("change", function () {
            fetchSubmissions(1);
        });
    if (td)
        td.addEventListener("change", function () {
            fetchSubmissions(1);
        });

    var si = document.getElementById("searchInput");
    if (si) {
        var t;
        si.addEventListener("input", function () {
            clearTimeout(t);
            t = setTimeout(function () {
                fetchSubmissions(1);
            }, 300);
        });
    }
}

init();

function mapStatusForApi(val) {
    if (!val) return "";
    var s = String(val).trim().toLowerCase();
    if (s === "pending response" || s === "pending-response" || s === "pending")
        return "pending";
    if (s === "responded" || s === "replied" || s === "resolved")
        return "replied";
    if (s === "archived") return "archived";
    return s;
}

async function previewResponse() {
    try {
        var subject = document.getElementById("replySubject").value.trim();
        var message = getReplyMessageText().trim();
        if (!message && !subject) {
            showNotification("Please add a subject or message to preview.", "error");
            return;
        }
        const entryId = currentSubmission && currentSubmission.id;
        if (!entryId) {
            showNotification("No submission selected to preview.", "error");
            return;
        }

        var previewEditor = document.getElementById("replyEditor");
        var previewHtml = null;
        try {
            if (
                previewEditor &&
                previewEditor.innerHTML &&
                previewEditor.innerHTML.trim() !== ""
            ) {
                previewHtml = cleanEditorHtml(previewEditor.innerHTML);
            } else {
                previewHtml = textToHtml(message);
            }
        } catch (e) {
            previewHtml = textToHtml(message);
        }

        const res = await fetch(
            `${API_BASE_URL}/contact-us/${entryId}/reply-preview`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: subject || null,
                    message: message || null,
                    html: previewHtml,
                }),
            }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to render preview");
        }
        const html = await res.text();
        const w = window.open("", "_blank");
        if (!w) {
            showNotification(
                "Popup blocked. Please allow popups for preview.",
                "error"
            );
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
    } catch (e) {
        showNotification(e.message || "Failed to preview email", "error");
    }
}

window.openModal = openModal;
window.closeModal = closeModal;
window.filterSubmissions = filterSubmissions;
window.clearFilters = clearFilters;
window.sortTable = sortTable;
window.updateStatus = updateStatus;
window.loadTemplate = loadTemplate;
window.sendResponse = sendResponse;
window.previewResponse = previewResponse;
window.openPropertyModal = openPropertyModal;
window.closePropertyModal = closePropertyModal;
window.archiveSubmission = archiveSubmission;
window.applySubmissionHighlight = applySubmissionHighlight;

function applySubmissionHighlight() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const targetId = params.get('submission_id') || params.get('id');
        if (!targetId) return;
        const row = document.querySelector(`tr[data-submission-id='${CSS.escape(targetId)}']`);
        if (!row) return;
        row.classList.add('highlight-pulse');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { row && row.classList.remove('highlight-pulse'); }, 3200);
    } catch (e) { /* noop */ }
}