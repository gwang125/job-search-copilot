import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { TailoredResumeContent } from "@/types/database";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  summary: {
    marginBottom: 12,
    lineHeight: 1.4,
    color: "#475569",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  skills: {
    marginBottom: 8,
    lineHeight: 1.4,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  jobTitle: {
    fontWeight: "bold",
    fontSize: 10,
  },
  dates: {
    color: "#64748b",
    fontSize: 9,
  },
  bullet: {
    marginLeft: 8,
    marginTop: 2,
    lineHeight: 1.35,
  },
});

interface ResumePdfProps {
  name: string;
  content: TailoredResumeContent;
}

export function ResumePdfDocument({ name, content }: ResumePdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{name}</Text>
        {content.summary && (
          <Text style={styles.summary}>{content.summary}</Text>
        )}

        {content.skills?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.skills}>{content.skills.join(" · ")}</Text>
          </>
        )}

        {content.experience?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {content.experience.map((exp, i) => (
              <View key={i}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle}>
                    {exp.title} — {exp.company}
                  </Text>
                  {exp.dates && <Text style={styles.dates}>{exp.dates}</Text>}
                </View>
                {(exp.bullets ?? []).map((b, j) => (
                  <Text key={j} style={styles.bullet}>
                    • {b}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}

        {content.education?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {content.education.map((edu, i) => (
              <View key={i} style={{ marginTop: 4 }}>
                <Text style={styles.jobTitle}>
                  {edu.school}
                  {edu.degree ? ` — ${edu.degree}` : ""}
                  {edu.major ? `, ${edu.major}` : ""}
                </Text>
                {edu.dates && <Text style={styles.dates}>{edu.dates}</Text>}
                {edu.details && <Text style={styles.bullet}>{edu.details}</Text>}
              </View>
            ))}
          </>
        )}

        {content.projects && content.projects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {content.projects.map((proj, i) => (
              <View key={i}>
                <Text style={styles.jobTitle}>
                  {proj.name}
                  {proj.technologies?.length
                    ? ` | ${proj.technologies.join(", ")}`
                    : ""}
                </Text>
                {(proj.bullets ?? []).map((b, j) => (
                  <Text key={j} style={styles.bullet}>
                    • {b}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
