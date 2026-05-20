import { Document, Page, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.6,
    color: "#1e293b",
  },
  paragraph: {
    marginBottom: 12,
  },
});

interface CoverLetterPdfProps {
  content: string;
}

export function CoverLetterPdfDocument({ content }: CoverLetterPdfProps) {
  const paragraphs = content.split(/\n\n+/).filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p.trim()}
          </Text>
        ))}
      </Page>
    </Document>
  );
}
