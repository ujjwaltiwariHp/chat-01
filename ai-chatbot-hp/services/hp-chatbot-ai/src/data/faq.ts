// backend/src/data/faq.ts

interface FAQEntry {
  questions: string[];
  answer: string;
}

interface FAQData {
  categories: Record<string, FAQEntry[]>;
}

export const FAQ_DATA: FAQData = {
  categories: {
    "Getting Started": [
      {
        questions: [
          "How do I start?",
          "What is the first step?",
          "How to use HangingPanda services?",
        ],
        answer:
          "You can start by booking a discovery call through our contact page or by sending us an inquiry. Our team will review your requirements and schedule a tailored consultation to map out your AI journey.",
      },
      {
        questions: ["Do you offer free trials?", "Can I test your products?"],
        answer:
          "We provide custom demonstrations for our core AI products (like the Chatbot and Widget). For specific software solutions, we can develop a Proof of Concept (PoC) to validate the value before full-scale development.",
      },
    ],
    "Company Info": [
      {
        questions: [
          "What does HP do?",
          "What is HangingPanda?",
          "Tell me about HP",
          "Details of your company",
        ],
        answer:
          "HangingPanda is an AI-first software development company headquartered in Noida, India. We specialize in building intelligent, production-grade AI products and custom software solutions for businesses worldwide.",
      },
      {
        questions: [
          "Where is HangingPanda located?",
          "What is your address?",
          "Where are you headquartered?",
        ],
        answer:
          "HangingPanda is headquartered at B-64, B Block, Sector 63, Noida, Uttar Pradesh, India, 201301. We serve clients globally across multiple time zones.",
      },
    ],
    Services: [
      {
        questions: [
          "What services do you offer?",
          "Tell me about your services",
          "HangingPanda solutions",
          "What can you build?",
        ],
        answer:
          "HangingPanda offers a comprehensive range of AI and software services:\n- **AI Chatbot Development**: Custom conversational AI with real-time streaming, context retention, and multi-channel deployment.\n- **Custom Machine Learning Solutions**: Tailored ML models, fine-tuned LLMs, and data pipelines for domain-specific needs.\n- **Web & Mobile App Development**: Full-stack development of modern, scalable applications.\n- **AI Consulting & Strategy**: Expert guidance on AI adoption, architecture, and integration into existing business workflows.\n- **Enterprise Integrations**: Seamless integration of AI capabilities into existing enterprise systems and tools.",
      },
      {
        questions: [
          "Do you support real-time streaming?",
          "Does your chatbot stream responses?",
        ],
        answer:
          "Yes, our chatbot delivers responses in real-time, word-by-word, providing a smooth and responsive user experience similar to leading AI platforms.",
      },
      {
        questions: ["Do you build mobile apps?", "Can you develop apps?"],
        answer:
          "Yes, HangingPanda builds cross-platform and native mobile applications alongside our AI solutions.",
      },
    ],
    "Technology & Approach": [
      {
        questions: [
          "What technologies do you use?",
          "What is your tech stack?",
        ],
        answer:
          "We use industry-leading, enterprise-grade technologies for AI, backend, and frontend development. Our stack is chosen for reliability, scalability, and performance. For specifics tailored to your project, we recommend a consultation with our team.",
      },
      {
        questions: [
          "How do you ensure service reliability?",
          "Is your platform reliable?",
        ],
        answer:
          "We follow industry best practices including circuit-breaker patterns, automated failovers, health monitoring, and graceful degradation to ensure high availability and reliability for all our solutions.",
      },
      {
        questions: ["How is data stored?", "Is my data stored securely?"],
        answer:
          "All data is stored in encrypted, production-grade databases with strict access controls. Messages are encrypted at rest and session-level authentication ensures only authorized access.",
      },
    ],
    "Security & Privacy": [
      {
        questions: [
          "Is my data safe?",
          "How do you handle security?",
          "What about privacy?",
        ],
        answer:
          "Security is a top priority at HangingPanda. Every session is authenticated, all inputs are sanitized to prevent common vulnerabilities, and data is encrypted both in transit and at rest. We follow OWASP best practices and implement rate limiting, input validation, and session management.",
      },
    ],
    Pricing: [
      {
        questions: [
          "How much do your services cost?",
          "What are your rates?",
          "Pricing details",
        ],
        answer:
          "Pricing varies based on project scope, complexity, and timeline. We offer flexible engagement models including fixed-price projects, dedicated teams, and hourly consulting. Contact us for a customized quote tailored to your requirements.",
      },
    ],
    "Process & Requirements": [
      {
        questions: [
          "What are the initial requirements to work with you?",
          "How do we get started?",
          "What do you need to begin a project?",
          "What is your process?",
        ],
        answer:
          "Getting started with HangingPanda is straightforward:\n1. **Discovery Call**: Share your project goals, target users, and timeline.\n2. **Proposal & SOW**: We draft a formal proposal and statement of work outlining scope, milestones, and pricing.\n3. **Kickoff**: Once approved, our team begins development with regular check-ins and progress updates.\nWe typically need a high-level briefing of your project goals, target timeline, and any specific technical constraints to get started.",
      },
    ],
    Portfolio: [
      {
        questions: [
          "What projects has HangingPanda worked on?",
          "Show me your portfolio",
          "Do you have case studies?",
        ],
        answer:
          "HangingPanda has delivered a range of successful projects including:\n- Custom LLM training for specialized business domains\n- Enterprise-grade AI integrations for high-traffic applications\n- Real-time streaming chatbots with context retention\n- Custom car rental platforms with complex fleet management logic\n- AI-powered automation tools for business workflows",
      },
      {
        questions: [
          "Do you have experience with custom LLM training?",
          "Can you fine-tune models?",
        ],
        answer:
          "Yes, HangingPanda specializes in fine-tuning large language models on proprietary datasets to create domain-specific AI experts tailored to your business needs.",
      },
      {
        questions: ["Have you worked with OpenAI API integrations?"],
        answer:
          "We have extensive experience with OpenAI and other leading AI provider integrations, including prompt engineering, cost optimization, and rate-limit management for high-traffic production applications.",
      },
    ],
    Contact: [
      {
        questions: [
          "How can I contact HangingPanda?",
          "Give me your contact details",
          "How can I contact you?",
          "What is your email or phone?",
          "Get in touch",
        ],
        answer:
          "You can reach us via [CONTACT_DETAILS: email={{EMAIL}}, phone={{PHONE}}, whatsapp={{WHATSAPP}}]",
      },
      {
        questions: ["What are your support hours?", "When are you available?"],
        answer:
          "Our HangingPanda team is typically available Monday through Friday, 9:00 AM to 6:00 PM IST. For urgent inquiries, feel free to reach out anytime and we will get back to you as soon as possible.",
      },
    ],
    "General Help": [
      {
        questions: [
          "I need help",
          "Help me",
          "How can you help me?",
          "What can I ask you?",
          "need hel",
        ],
        answer:
          'I can help you with questions about HangingPanda\'s AI solutions, app development services, pricing, or our company background. You can ask things like "What services do you offer?", "How do I start a project?", or "Tell me about your AI expertise."',
      },
    ],
  },
};

export function buildFAQPrompt(version: "v1" | "v2" = "v2"): string {
  if (version === "v1") {
    let text = "\n\nHANGINGPANDA KNOWLEDGE BASE:\n";
    Object.entries(FAQ_DATA.categories).forEach(([category, faqs]) => {
      text += `\n## ${category}\n`;
      faqs.forEach((faq) => {
        const questionsStr = faq.questions.join(" / ");
        text += `Q: ${questionsStr}\nA: ${faq.answer}\n\n`;
      });
    });
    text += `\nCONTACT INFORMATION:\n`;
    text += `Email: {{EMAIL}}\n`;
    text += `Phone/WhatsApp: {{PHONE}}\n`;
    return text;
  }

  // V2 Semantic Format
  let text = "\n\n### HANGINGPANDA KNOWLEDGE BASE (Source of Truth)\n";
  text += "--- DOCUMENT START ---\n";

  Object.entries(FAQ_DATA.categories).forEach(([category, faqs]) => {
    text += `\n#### CATEGORY: ${category}\n`;
    faqs.forEach((faq) => {
      text += `- **Topic**: ${faq.questions[0]}\n`;
      text += `  **Information**: ${faq.answer}\n\n`;
    });
  });

  text += "--- DOCUMENT END ---\n";

  // Dedicated Contact Info for V2
  text += `\n### OFFICIAL CONTACT CHANNELS\n`;
  text += `- **Email**: {{EMAIL}}\n`;
  text += `- **Phone & WhatsApp**: {{PHONE}}\n`;

  return text;
}
